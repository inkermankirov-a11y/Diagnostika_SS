"""Account registry integration test; temporary SQLite and local HTTP only."""
import os, tempfile, runpy, pathlib, time, threading, json, urllib.request, urllib.error
with tempfile.TemporaryDirectory() as tmp:
    os.environ["ACCOUNT_DATA"]=tmp
    m=runpy.run_path(str(pathlib.Path(__file__).with_name("service.py")))
    db=m["db"]
    password="local-test-admin-123"
    with db() as c:
        c.execute("BEGIN IMMEDIATE")
        admin=m["create_user"](c,"admin@example.invalid",password,"admin")
        uid=m["create_user"](c,"person@example.invalid","local-test-user-123","specialist")
        sid=m["ids"](c,uid)["specialist"]
        admin_id=m["ids"](c,admin)["specialist"]
        c.execute("INSERT INTO sessions VALUES(?,?,?)",(m["digest"]("admin-test-token"),admin,int(time.time())+3600))
        c.execute("INSERT INTO sessions VALUES(?,?,?)",(m["digest"]("user-test-token"),uid,int(time.time())+3600))
    server=m["Server"](("127.0.0.1",0),m["Handler"])
    t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
    def call(path,data=None,expected=200,token="admin-test-token"):
        req=urllib.request.Request("http://127.0.0.1:"+str(server.server_port)+"/account/api/"+path,
            data=None if data is None else json.dumps(data).encode(),
            headers={"Cookie":"__Host-zabvenye_account="+token,"Origin":m["ORIGIN"],"Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(req,timeout=10) as r: status=r.status; result=json.load(r)
        except urllib.error.HTTPError as r: status=r.code; result=json.load(r)
        assert status==expected,(path,status,expected,result)
        return result
    try:
        for lang in ("ru","en","fr","de","it","invalid"):
            with urllib.request.urlopen("http://127.0.0.1:"+str(server.server_port)+"/account/license?lang="+lang,timeout=10) as response:
                page=response.read().decode()
                assert response.status==200 and response.headers["Content-Type"].startswith("text/html")
                assert 'https://t.me/zabvenye_com/8?comment=3' in page and '#register' in page
                assert ('lang="'+(lang if lang!="invalid" else "ru")+'"') in page
                assert '499' in page and '299' in page and ('3 588' in page or '3,588' in page)
        with db() as conn:
            conn.execute("UPDATE users SET onboarding_required=0,first_name='Test',last_name='Specialist' WHERE id IN (?,?)",(admin,uid))
            conn.execute("INSERT INTO sessions VALUES(?,?,?)",(m["digest"]("second-device-token"),uid,int(time.time())+3600))
        call("admin/statistics",expected=403,token="user-test-token")
        call("admin/statistics",expected=401,token="")
        call("admin/statistics?days=2",expected=400)
        empty_stats=call("admin/statistics")
        assert empty_stats["total"]==1 and empty_stats["clients_snapshot"]==0
        call("metrics",{"clients":3},token="user-test-token")
        stats=call("admin/statistics?days=7")
        assert stats["active"]==1 and stats["clients_snapshot"]==3 and stats["reported_accounts"]==1 and len(stats["series"])==7
        extra={"counts":{"sessions":4,"completed_sessions":3},"income":{"RUB":100000},"device":{"browser":"Chrome","os":"Windows","type":"desktop"},"events":{"sessions":2},"batch":"12345678-1234-1234-1234-123456789abc"}
        call("metrics",{"clients":3,"advanced":extra},expected=403,token="user-test-token")
        call("analytics-preference",{"enabled":True},token="user-test-token")
        call("metrics",{"clients":3,"advanced":extra},token="user-test-token")
        call("metrics",{"clients":3,"advanced":extra},token="user-test-token")
        advanced=call("admin/statistics")["advanced"]
        assert advanced["counts"]["completed_sessions"]==3 and advanced["income"]["RUB"]==100000 and advanced["events"]["sessions"]==2
        call("metrics",{"clients":3,"advanced":{**extra,"counts":{"client_name":"private"}}},expected=400,token="user-test-token")
        call("analytics-preference",{"enabled":False},token="user-test-token")
        assert call("admin/statistics")["advanced"]["reported_accounts"]==0
        initial=call("workspace-profile",token="user-test-token")
        assert initial["profile"] is None and initial["revision"]==0 and initial["identity"]=={"name":"Test","surname":"Specialist"}
        call("workspace-profile",expected=401,token="")
        fields={key:"" for key in m["WORKSPACE_FIELDS"]}
        fields.update(name="Test",surname="Specialist",title="Counselor",city="Example",country="Example",countryCode="NL",currencyCode="EUR",areas=["Consulting"],avatar="")
        body={"account_id":sid,"revision":0,"profile":fields}
        call("workspace-profile",{**body,"account_id":admin_id},expected=403,token="user-test-token")
        call("workspace-profile",{**body,"profile":{**fields,"clients":[]}},expected=400,token="user-test-token")
        call("workspace-profile",{**body,"profile":{**fields,"avatar":"data:image/svg+xml;base64,AAAA"}},expected=400,token="user-test-token")
        call("workspace-profile",{**body,"profile":{**fields,"avatar":"data:image/jpeg;base64,"+"A"*90000}},expected=400,token="user-test-token")
        # A tiny JPEG marker fixture exercises the bounded data-URL transport.
        fields["avatar"]="data:image/jpeg;base64,/9j//9k="
        saved=call("workspace-profile",body,token="user-test-token")
        assert saved["revision"]==1 and saved["profile"]==fields
        assert call("workspace-profile",token="second-device-token")["profile"]==fields
        assert call("workspace-profile")["profile"] is None
        call("workspace-profile",body,expected=409,token="second-device-token")
        saved=call("workspace-profile",{**body,"revision":1,"profile":{**fields,"avatar":""}},token="second-device-token")
        assert saved["revision"]==2 and saved["profile"]["avatar"]==""
        assert call("workspace-profile",token="user-test-token")["profile"]["avatar"]==""
        # Verify localized welcome mail and reset token lifetime without external SMTP.
        sent=[]
        glob=m["send_reset_request"].__globals__
        glob["send_mail"]=lambda recipient,subject,body:sent.append((recipient,subject,body))
        with db() as conn:
            reset_uid=m["create_user"](conn,"reset@example.invalid","old-password-test-123","specialist")
            conn.execute("UPDATE users SET onboarding_required=0,ui_language='it' WHERE id=?",(reset_uid,))
            conn.execute("INSERT INTO welcome_mail(user_id,language) VALUES(?,?)",(reset_uid,"it"))
            conn.execute("INSERT INTO sessions VALUES(?,?,?)",(m["digest"]("reset-session"),reset_uid,int(time.time())+3600))
        m["send_next_welcome"]()
        assert sent[-1][1]=="Benvenuto su ZABVENYE!" and "https://t.me/zabvenye_com" in sent[-1][2]
        m["send_next_welcome"]()
        assert len(sent)==1
        glob["mail_config"]=lambda:{"test":True}
        glob["captcha"]=lambda token:token=="test-captcha"
        call("password-reset-request",{"email":"reset@example.invalid","captcha":"invalid"},expected=403,token="")
        call("password-reset-request",{"email":"unknown@example.invalid","captcha":"test-captcha"},expected=404,token="")
        assert len(sent)==1
        result=call("password-reset-request",{"email":"reset@example.invalid","captcha":"test-captcha"},token="")
        assert result["sent"] is True
        assert sent[-1][1]=="Reimposta la password di ZABVENYE"
        import re
        reset_token=re.search(r"#reset=([A-Za-z0-9_-]{43})",sent[-1][2]).group(1)
        with db() as conn:
            row=conn.execute("SELECT * FROM password_resets WHERE user_id=?",(reset_uid,)).fetchone()
            assert row["token"]==m["digest"](reset_token) and 1790<=row["expires"]-int(time.time())<=1800
        data={"token":reset_token,"password":"new-password-test-123","password_repeat":"new-password-test-123"}
        call("password-reset-confirm",data,token="")
        call("password-reset-confirm",data,expected=400,token="")
        call("me",expected=401,token="reset-session")
        with db() as conn:
            assert m["password_ok"](data["password"],conn.execute("SELECT password FROM users WHERE id=?",(reset_uid,)).fetchone()[0])
            conn.execute("INSERT INTO password_resets VALUES(?,?,?)",(m["digest"]("X"*43),reset_uid,int(time.time())-1))
        call("password-reset-confirm",{**data,"token":"X"*43},expected=400,token="")
        with db() as conn:
            for table in ("password_resets","welcome_mail","sessions"):
                conn.execute("DELETE FROM "+table+" WHERE user_id=?",(reset_uid,))
            conn.execute("DELETE FROM users WHERE id=?",(reset_uid,))
        def broken_smtp(*args): raise OSError("SMTP test failure")
        glob["send_mail"]=broken_smtp
        call("password-reset-request",{"email":"admin@example.invalid","captcha":"test-captcha"},expected=503,token="")
        glob["send_mail"]=lambda recipient,subject,body:sent.append((recipient,subject,body))
        print("Password reset and localized welcome delivery (mock SMTP): PASS")
        a=call("admin/invite",{"hours":24,"comment":"first"})
        b=call("admin/invite",{"hours":24,"comment":"second"})
        assert a["license_number"]=="000001" and b["license_number"]=="000002"
        assert [x["license_number"] for x in call("admin/invites")["items"]]==["000002","000001"]
        assert call("admin/invites?q=000001")["items"][0]["id"]==a["id"]
        assert call("admin/invite-detail?id="+a["id"])["license_number"]=="000001"
        before=call("admin/invite-detail?id="+a["id"])
        def check_renew(hours,status):
            now=int(time.time())
            result=call("admin/invite-reissue",{"id":a["id"],"hours":hours})
            assert result["status"]=="active" and result["id"]==a["id"] and result["license_number"]==a["license_number"]
            assert result["code"]==a["invite"] and result["comment"]==before["comment"] and result["created"]==before["created"]
            assert result["email"]==before["email"] and result["revoked_at"] is None
            assert result["expires"]==0 if hours==0 else now+hours*3600<=result["expires"]<=int(time.time())+hours*3600
            with db() as conn:
                assert conn.execute("SELECT count(*) FROM license_numbers").fetchone()[0]==2
                assert conn.execute("SELECT token FROM invites WHERE public_id=?",(a["id"],)).fetchone()[0]==m["digest"](a["invite"])
            print("Renew "+status+" license: PASS")
        call("admin/invite-reissue",{"id":a["id"],"hours":12},expected=400)
        call("admin/invite-reissue",{"id":a["id"],"hours":24},expected=403,token="user-test-token")
        check_renew(72,"active")
        with db() as conn: conn.execute("UPDATE invites SET expires=? WHERE public_id=?",(int(time.time())-1,a["id"]))
        check_renew(168,"expired")
        call("admin/invite-revoke",{"id":a["id"]})
        check_renew(0,"revoked")
        with db() as conn: conn.execute("UPDATE invites SET used_at=?,used_by=? WHERE public_id=?",(int(time.time()),uid,b["id"]))
        call("admin/invite-reissue",{"id":b["id"],"hours":24},expected=409)
        call("admin/invite-revoke",{"id":a["id"]})
        call("admin/invite-delete",{"id":a["id"]})
        c=call("admin/invite",{"hours":24})
        assert c["license_number"]=="000003"
        call("admin/delete",{"id":sid},expected=403,token="user-test-token")
        call("admin/delete",{"id":admin_id},expected=404)
        call("admin/delete",{"id":sid})
        call("me",expected=401,token="user-test-token")
        assert call("admin/users?status=deleted")["items"][0]["id"]==sid
        call("admin/purge",{"id":sid,"confirm_id":sid,"password":password},expected=409)
        assert call("admin/restore",{"id":sid})["enabled"] is True
        assert call("admin/users?status=deleted")["total"]==0
        call("admin/delete",{"id":sid})
        with db() as conn:
            conn.execute("UPDATE users SET archived_at=? WHERE id=?",(int(time.time())-86500,uid))
        call("admin/purge",{"id":sid,"confirm_id":"invalid","password":password},expected=400)
        call("admin/purge",{"id":sid,"confirm_id":sid,"password":"wrong-password-123"},expected=403)
        call("admin/purge",{"id":sid,"confirm_id":sid,"password":password})
        call("admin/restore",{"id":sid},expected=404)
        with db() as conn:
            assert not conn.execute("SELECT 1 FROM users WHERE id=?",(uid,)).fetchone()
            assert not conn.execute("SELECT 1 FROM workspace_profiles WHERE user_id=?",(uid,)).fetchone()
            assert conn.execute("SELECT 1 FROM public_ids WHERE owner=?",(uid,)).fetchone()
            assert conn.execute("SELECT 1 FROM specialist_tombstones WHERE user_id=?",(uid,)).fetchone()
            assert conn.execute("SELECT count(*) FROM license_numbers").fetchone()[0]==3
            assert conn.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
        print("Account lifecycle and license numbering integration: PASS")
    finally:
        server.shutdown();server.server_close();t.join()
