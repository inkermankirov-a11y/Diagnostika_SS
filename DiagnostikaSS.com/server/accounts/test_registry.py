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
                assert 'https://t.me/Evgeniy_Prudnikov' in page and '#register' in page
                assert ('lang="'+(lang if lang!="invalid" else "ru")+'"') in page
                assert 'FREE' in page and 'STANDARD' in page and 'VIP' not in page and 'HCS' not in page
                assert '399' in page and '199' in page and ('2 388' in page or '2,388' in page)
                assert ('5 USD' in page or 'USD 5' in page) and ('30 USD' in page or 'USD 30' in page)
                assert ('2,50 USD' in page or '2.50 USD' in page) and '50' in page
                assert 'crypto' not in page.lower() and 'крипт' not in page.lower()
                assert 'img-src \'self\'' in response.headers['Content-Security-Policy']
                assert page.count('<img ') == 3 and '/account/mascot-guide.webp' in page and '/account/mascot-pricing.webp' in page
                assert '<div class="lp-brand"><img src="/account/zabvenye-orb.webp"' in page
                assert page.count('https://t.me/Evgeniy_Prudnikov') == 3
                if lang in ('ru','invalid'):
                    assert 'Подготовьте документы' in page and 'в личные сообщения Telegram' in page
        for asset in ('mascot-guide.webp','mascot-pricing.webp','zabvenye-orb.webp'):
            with urllib.request.urlopen('http://127.0.0.1:'+str(server.server_port)+'/account/'+asset,timeout=10) as response:
                body=response.read()
                assert response.headers['Content-Type']=='image/webp' and body[:4]==b'RIFF' and body[8:12]==b'WEBP'
                assert body==pathlib.Path(__file__).with_name(asset).read_bytes()
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
        a=call("admin/invite",{"hours":24,"comment":"first","access_plan":"vip"})
        b=call("admin/invite",{"hours":24,"comment":"second","access_plan":"vip"})
        assert a["license_number"]=="000001" and b["license_number"]=="000002"
        assert [x["license_number"] for x in call("admin/invites")["items"]]==["000002","000001"]
        assert [x["license_number"] for x in call("admin/invites?sort=number&dir=asc")["items"]]==["000001","000002"]
        assert [x["license_number"] for x in call("admin/invites?sort=recipient&dir=asc")["items"]]==["000001","000002"]
        for sort in ("created","expires","status","owner","invalid"):
            assert call("admin/invites?sort="+sort+"&dir=asc")["total"]==2
        assert call("admin/invites?status=active")["total"]==2
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
        assert call("admin/invites?status=expired")["items"][0]["id"]==a["id"]
        check_renew(168,"expired")
        call("admin/invite-revoke",{"id":a["id"]})
        check_renew(0,"revoked")
        with db() as conn: conn.execute("UPDATE invites SET used_at=?,used_by=? WHERE public_id=?",(int(time.time()),uid,b["id"]))
        call("admin/invite-reissue",{"id":b["id"],"hours":24},expected=409)
        call("admin/invite-revoke",{"id":a["id"]})
        call("admin/invite-delete",{"id":a["id"]})
        c=call("admin/invite",{"hours":24,"access_plan":"vip"})
        assert c["license_number"]=="000003"
        call("admin/invite",{"hours":24,"access_plan":"trial"},expected=400)
        tr=call("admin/invite",{"hours":72,"access_plan":"trial","email":"trial@example.invalid"})
        assert call("admin/invite-detail?id="+tr["id"])["access_plan"]=="trial"
        with db() as conn:
            trial_id=m["create_user"](conn,"trial@example.invalid","trial-fixture-password","specialist")
            now=int(time.time())
            m["activate_plan"](conn,trial_id,"trial",now)
            conn.execute("INSERT INTO sessions VALUES(?,?,?)",(m["digest"]("trial-token"),trial_id,now+86400))
            trial_sid=m["ids"](conn,trial_id)["specialist"]
        with db() as conn:
            conn.execute("UPDATE invites SET used_at=?,used_by=? WHERE public_id=?",(now,trial_id,tr["id"]))
        def check_license_status(expected):
            item=call("admin/invite-detail?id="+tr["id"])
            assert item["status"]==expected,item
            assert any(x["id"]==tr["id"] for x in call("admin/invites?status="+expected)["items"])
            return item
        check_license_status("used")
        assert call("me",token="trial-token")["trial"]["expires"]==m["trial_end"](now)
        keys=[f"00000000-0000-4000-8000-{i:012d}" for i in range(6)]
        for key in keys[:5]:
            call("trial-reserve",{"feature":"clients","client":key},token="trial-token")
            for _ in range(4):call("trial-reserve",{"feature":"sessions","client":key},token="trial-token")
            call("trial-reserve",{"feature":"sessions","client":key},expected=429,token="trial-token")
            for kind in ("requests","situations"):
                call("trial-reserve",{"feature":kind,"client":key},token="trial-token")
                call("trial-reserve",{"feature":kind,"client":key},expected=429,token="trial-token")
        call("trial-reserve",{"feature":"clients","client":keys[5]},expected=429,token="trial-token")
        with db() as conn:
            u=conn.execute("SELECT * FROM users WHERE id=?",(trial_id,)).fetchone()
            for i in range(10):m["reserve_trial"](conn,u,"ai")
            try:
                m["reserve_trial"](conn,u,"ai")
                assert False,"11th AI request accepted"
            except m["Error"] as exc: assert exc.status==429
        assert call("me",token="trial-token")["trial"]["used"]=={"clients":5,"sessions":20,"requests":5,"situations":5,"ai":10}
        assert call("me",token="trial-token")["trial"]["remaining_ai"]==0
        with db() as conn:conn.execute("UPDATE users SET trial_expires=? WHERE id=?",(int(time.time())-1,trial_id))
        check_license_status("awaiting_payment")
        assert not any(x["id"]==tr["id"] for x in call("admin/invites?status=used")["items"])
        call("me",expected=403,token="trial-token")
        call("workspace-auth",expected=401,token="trial-token")
        paid_at=int(time.time())
        payment={"id":trial_sid,"period":"month","paid_at":paid_at,"request_id":"10000000-0000-4000-8000-000000000001"}
        call("admin/subscription-payment",payment,expected=403,token="user-test-token")
        first=call("admin/subscription-payment",payment)
        assert first["billing"]["plan"]=="STANDARD" and first["billing"]["last_payment"]["amount"]==399
        until=first["billing"]["expires"]
        assert check_license_status("used")["access_expires"]==until
        assert call("admin/subscription-payment",payment)["billing"]["expires"]==until
        second=call("admin/subscription-payment",{**payment,"period":"year","request_id":"10000000-0000-4000-8000-000000000002"})
        assert second["billing"]["expires"]==m["add_months"](until,12)
        assert call("me",token="trial-token")["billing"]["plan"]=="STANDARD"
        assert len(call("admin/subscription-history?id="+trial_sid)["items"])==2
        assert call("admin/subscriptions")["income"]==2787
        with db() as conn:conn.execute("UPDATE users SET subscription_expires=? WHERE id=?",(int(time.time())-1,trial_id))
        check_license_status("awaiting_payment")
        call("me",expected=403,token="trial-token")
        call("workspace-auth",expected=401,token="trial-token")
        call("admin/grant-vip",{"id":trial_sid},expected=403,token="user-test-token")
        assert call("admin/grant-vip",{"id":trial_sid})["billing"]["plan"]=="VIP"
        assert call("me",token="trial-token")["billing"]["expires"] is None
        assert check_license_status("used")["access_expires"] is None
        assert call("admin/grant-vip",{"id":trial_sid})["notifications_unread"]==3
        inbox=call("notifications",token="trial-token")
        assert inbox["total"]==3 and inbox["unread"]==3
        vip=[n for n in inbox["items"] if n["kind"]=="vip"]
        assert len(vip)==1 and "VIP" in vip[0]["title"]
        assert call("me",token="trial-token")["vip_popup_pending"] is True
        assert call("notifications/claim-vip",{},token="trial-token")["item"]["id"]==vip[0]["id"]
        assert call("notifications/claim-vip",{},token="trial-token")["item"] is None
        assert call("me",token="trial-token")["vip_popup_pending"] is False
        assert call("notifications",token="user-test-token")["items"]==[]
        call("notifications/read",{"id":vip[0]["id"]},expected=404,token="user-test-token")
        assert call("notifications/read",{"id":vip[0]["id"]},token="trial-token")["unread"]==2
        notice={"id":trial_sid,"title":"Test notice","body":"Test body","email":False,"request_id":"20000000-0000-4000-8000-000000000001"}
        call("admin/notify",notice,expected=403,token="user-test-token")
        call("admin/notify",notice)
        call("admin/notify",notice)
        assert call("notifications",token="trial-token")["total"]==4
        notice_id=notice["request_id"]
        assert call("notifications?view=archive",token="trial-token")["total"]==0
        call("notifications/archive",{"id":notice_id,"archived":True},expected=404,token="user-test-token")
        call("notifications/archive",{"id":notice_id,"archived":"true"},expected=400,token="trial-token")
        assert call("notifications/archive",{"id":notice_id,"archived":True},token="trial-token")["unread"]==2
        active=call("notifications",token="trial-token")
        archived=call("notifications?view=archive",token="trial-token")
        assert active["total"]==3 and active["unread"]==2
        assert archived["total"]==1 and archived["items"][0]["id"]==notice_id
        assert archived["items"][0]["archived"] and not archived["items"][0]["read"]
        assert call("notifications/read",{"id":"all"},token="trial-token")["unread"]==0
        assert not call("notifications?view=archive",token="trial-token")["items"][0]["read"]
        assert call("notifications/archive",{"id":notice_id,"archived":False},token="trial-token")["unread"]==1
        assert call("notifications",token="trial-token")["total"]==4
        assert call("notifications/read",{"id":notice_id},token="trial-token")["unread"]==0
        assert call("notifications/archive",{"id":notice_id,"archived":True},token="trial-token")["unread"]==0
        assert call("notifications/archive",{"id":notice_id,"archived":True},token="trial-token")["unread"]==0
        assert call("notifications?view=archive",token="trial-token")["items"][0]["read"]
        assert call("notifications/archive",{"id":notice_id,"archived":False},token="trial-token")["unread"]==0
        call("notifications?view=invalid",expected=400,token="trial-token")
        call("notifications/delete",{"id":notice_id},expected=404,token="trial-token")
        assert call("notifications",token="trial-token")["total"]==4
        with db() as conn:
            conn.execute("UPDATE users SET ui_language='fr' WHERE id=?",(trial_id,))
        assert "Félicitations" in [n for n in call("notifications",token="trial-token")["items"] if n["kind"]=="vip"][0]["title"]
        old_sent=len(sent)
        for _ in range(5):m["send_next_notification"]()
        new_mail=sent[old_sent:]
        assert len(new_mail)==3 and sum("VIP" in msg[1] for msg in new_mail)==1
        assert all(msg[0]=="trial@example.invalid" for msg in new_mail)
        m["send_next_notification"]()
        assert len(sent)==old_sent+3
        print("Notifications: VIP, payment, inbox, authorization, idempotency and localized email: PASS")
        call("admin/subscription-payment",{**payment,"request_id":"10000000-0000-4000-8000-000000000003"},expected=409)
        call("admin/invite",{"hours":24,"access_plan":"standard","email":"paid@example.invalid"},expected=400)
        paid_inv=call("admin/invite",{"hours":24,"access_plan":"standard","email":"paid@example.invalid","period":"year","paid_at":paid_at})
        assert call("admin/invite-detail?id="+paid_inv["id"])["paid_amount"]==2388
        call("admin/invite",{"hours":24,"access_plan":"standard","email":"paid@example.invalid","period":"year","paid_at":paid_at},expected=409)
        assert any(row["public_id"]==paid_inv["id"] for row in call("admin/subscriptions")["pending"])
        with db() as conn:conn.execute("UPDATE subscription_payments SET amount=3588 WHERE invite_id=?",(paid_inv["id"],))
        assert call("admin/invite-detail?id="+paid_inv["id"])["paid_amount"]==3588
        with db() as conn:
            paid_uid=m["create_user"](conn,"paid@example.invalid","fixture-password-paid","specialist")
            inv=conn.execute("SELECT * FROM invites WHERE public_id=?",(paid_inv["id"],)).fetchone()
            m["activate_plan"](conn,paid_uid,"standard",paid_at,inv)
            user=conn.execute("SELECT * FROM users WHERE id=?",(paid_uid,)).fetchone()
            assert m["billing_summary"](conn,user)["expires"]==m["add_months"](paid_at,12)
        with db() as conn:
            conn.execute("UPDATE users SET access_plan='trial',trial_policy=1,trial_expires=? WHERE id=?",(now+86400,trial_id))
            legacy=conn.execute("SELECT * FROM users WHERE id=?",(trial_id,)).fetchone()
            assert m["trial_usage"](conn,legacy)["caps"]["ai"]==20 and m["trial_usage"](conn,legacy)["caps"]["sessions_per_client"]==5
        print("Subscriptions, early renewal, idempotency and VIP: PASS")
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
            assert conn.execute("SELECT count(*) FROM license_numbers").fetchone()[0]==5
            assert conn.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
        print("Account lifecycle and license numbering integration: PASS")
        # HCS is an invitation-only, free six-calendar-month licence.
        call("admin/invite",{"hours":24,"access_plan":"hcs"},expected=400)
        call("admin/invite",{"hours":24,"access_plan":"hcs","email":"student@example.invalid","period":"year","paid_at":paid_at},expected=400)
        hcs=call("admin/invite",{"hours":24,"access_plan":"hcs","email":"student@example.invalid"})
        assert hcs["access_plan"]=="hcs" and hcs["mail_queued"]
        call("admin/invite",{"hours":24,"access_plan":"hcs","email":"student@example.invalid"},expected=409)
        detail=call("admin/invite-detail?id="+hcs["id"])
        assert detail["paid_amount"] is None and detail["billing_period"] is None
        with db() as conn:
            student=m["create_user"](conn,"student@example.invalid","fixture-student-password","specialist")
            inv=conn.execute("SELECT * FROM invites WHERE public_id=?",(hcs["id"],)).fetchone()
            activated=int(time.time())
            m["activate_plan"](conn,student,inv["access_plan"],activated,inv)
            conn.execute("UPDATE invites SET used_at=?,used_by=? WHERE public_id=?",(activated,student,hcs["id"]))
            conn.execute("UPDATE users SET onboarding_required=0 WHERE id=?",(student,))
            conn.execute("INSERT INTO sessions VALUES(?,?,?)",(m["digest"]("hcs-test-token"),student,activated+3600))
            student_sid=m["ids"](conn,student)["specialist"]
            assert conn.execute("SELECT count(*) FROM subscription_payments WHERE user_id=? OR invite_id=?",(student,hcs["id"])).fetchone()[0]==0
        info=call("me",token="hcs-test-token")
        until=info["billing"]["expires"]
        assert info["billing"]["plan"]=="HCS" and info["billing"]["period"]=="six_months"
        assert until==m["add_months"](activated,6) and info["trial"] is None
        assert info["limits"]==m["DEFAULT"] and info["legal_version"]=="1.1-hcs"
        assert call("workspace-auth",token="hcs-test-token")["ok"]
        assert call("admin/invite-detail?id="+hcs["id"])["access_expires"]==until
        before=call("admin/subscriptions")
        assert before["counts"]["hcs_active"]==1
        req={"id":student_sid,"expected_expires":until}
        call("admin/renew-hcs",req,expected=403,token="hcs-test-token")
        renewed=call("admin/renew-hcs",req)
        assert renewed["billing"]["expires"]==m["add_months"](until,6)
        call("admin/renew-hcs",req,expected=409)
        assert call("admin/subscriptions")["income"]==before["income"]
        assert call("admin/subscriptions")["counts"]["paid_active"]==before["counts"]["paid_active"]
        expired=int(time.time())-10
        with db() as conn:conn.execute("UPDATE users SET subscription_expires=? WHERE id=?",(expired,student))
        call("me",expected=403,token="hcs-test-token")
        call("workspace-auth",expected=401,token="hcs-test-token")
        assert call("admin/invite-detail?id="+hcs["id"])["status"]=="awaiting_renewal"
        assert any(i["id"]==hcs["id"] for i in call("admin/invites?status=awaiting_renewal")["items"])
        assert call("admin/subscriptions")["counts"]["hcs_expired"]==1
        restarted=call("admin/renew-hcs",{"id":student_sid,"expected_expires":expired})
        assert restarted["billing"]["expires"]>=m["add_months"](expired+10,6)
        assert call("me",token="hcs-test-token")["billing"]["plan"]=="HCS"
        assert call("workspace-auth",token="hcs-test-token")["ok"]
        assert call("admin/invite-detail?id="+hcs["id"])["status"]=="used"
        assert call("admin/subscription-history?id="+student_sid)["items"]==[]
        from datetime import datetime,timezone
        eom=int(datetime(2026,8,31,12,tzinfo=timezone.utc).timestamp())
        assert datetime.fromtimestamp(m["add_months"](eom,6),timezone.utc).isoformat()=="2027-02-28T12:00:00+00:00"
        print("HCS: free activation, calendar expiry, admin renewal, access guard, registry and revenue isolation: PASS")
        # Existing user consents remain valid: no silent retroactive replacement.
        with db() as conn:
            conn.execute("INSERT OR REPLACE INTO legal_acceptance(user_id,version,accepted_at,language) VALUES(?,?,?,?)",(student,"1.0-hcs",activated,"ru"))
        old_user=call("me",token="hcs-test-token")
        assert old_user["legal_version"]=="1.1-hcs" and old_user["legal_acceptance"]["version"]=="1.0-hcs"
        assert call("workspace-status",token="hcs-test-token")["billing"]["plan"]=="HCS"
        print("PASS: prior agreement preserved without new acceptance gate")
        # Specialists can update their own identity from workspace settings but cannot manage accounts.
        restored=call("workspace-status",token="hcs-test-token")
        assert restored["role"]=="specialist"
        personal={"first_name":"Student","last_name":"Test","gender":"female","birth_date":"1990-03-10","country":"Canada","city":"Montreal","timezone":"America/Toronto"}
        assert call("profile",personal,token="hcs-test-token")["ok"]
        updated=call("workspace-status",token="hcs-test-token")
        assert all(updated[k]==v for k,v in personal.items())
        assert call("workspace-status")["role"]=="admin"
        call("admin/users",expected=403,token="hcs-test-token")
        call("admin/invite",{"hours":24,"access_plan":"vip"},expected=403,token="hcs-test-token")
        call("profile",{**personal,"timezone":"invalid"},expected=400,token="hcs-test-token")
        print("PASS: workspace personal data saved, admin APIs inaccessible to specialists")
        # Admin can follow a registered specialist's original license, even after plan changes.
        linked=call("admin/specialist-licenses?id="+student_sid)
        assert len(linked["items"])==1 and linked["items"][0]["id"]==hcs["id"]
        assert linked["items"][0]["license_number"]==hcs["license_number"]
        assert linked["items"][0]["access_plan"]=="hcs"
        call("admin/specialist-licenses?id="+student_sid,expected=403,token="hcs-test-token")
        call("admin/specialist-licenses?id=000000",expected=404)
        with db() as conn:
            prior_payments=conn.execute("SELECT count(*) FROM subscription_payments WHERE user_id=?",(student,)).fetchone()[0]
            prior_notices=conn.execute("SELECT count(*) FROM account_notifications WHERE user_id=?",(student,)).fetchone()[0]
            prior_audit=conn.execute("SELECT count(*) FROM audit WHERE target=? AND action='change-plan'",(student,)).fetchone()[0]
        original=call("me",token="hcs-test-token")
        request={"id":student_sid,"plan":"trial","period":None,"reason":"Учебный тест","expected_plan":"hcs","expected_expires":original["billing"]["expires"]}
        call("admin/change-plan",request,expected=403,token="hcs-test-token")
        call("admin/change-plan",{**request,"id":"000000"},expected=404)
        call("admin/change-plan",{**request,"plan":"standard","period":None},expected=400)
        call("admin/change-plan",{**request,"plan":"invalid"},expected=400)
        call("admin/change-plan",{**request,"period":"year"},expected=400)
        changed=call("admin/change-plan",request)
        assert changed["billing"]["plan"]=="FREE" and changed["trial"]["caps"]["ai"]==10
        assert changed["limits"]==m["TRIAL_LIMITS"]
        assert changed["billing"]["expires"]==m["trial_end"](int(time.time())) or abs(changed["billing"]["expires"]-m["trial_end"](int(time.time())))<=1
        call("admin/change-plan",request,expected=409)
        with db() as conn:
            conn.execute("INSERT OR REPLACE INTO trial_usage VALUES(?,?,?)",(student,"ai",10))
        request={"id":student_sid,"plan":"hcs","period":None,"reason":"","expected_plan":"trial","expected_expires":changed["billing"]["expires"]}
        changed=call("admin/change-plan",request)
        assert changed["billing"]["plan"]=="HCS" and changed["limits"]==m["DEFAULT"] and changed["trial"] is None
        assert changed["billing"]["expires"]>=m["add_months"](int(time.time())-2,6)
        request={"id":student_sid,"plan":"vip","period":None,"reason":"","expected_plan":"hcs","expected_expires":changed["billing"]["expires"]}
        changed=call("admin/change-plan",request)
        assert changed["billing"]["plan"]=="VIP" and changed["billing"]["expires"] is None
        request={"id":student_sid,"plan":"standard","period":"month","reason":"Бесплатное администраторское предоставление","expected_plan":"vip","expected_expires":None}
        changed=call("admin/change-plan",request)
        assert changed["billing"]["plan"]=="STANDARD" and changed["billing"]["period"]=="month"
        assert changed["billing"]["basis"]=="complimentary" and changed["billing"]["expires"]>int(time.time())
        summary=call("admin/subscriptions")
        assert summary["counts"]["paid_active"]==before["counts"]["paid_active"]
        assert summary["counts"]["complimentary_active"]==before["counts"]["complimentary_active"]+1
        assert summary["income"]==before["income"]
        assert summary["total"]>=len(summary["items"])
        assert call("admin/invite-detail?id="+hcs["id"])["current_access_plan"]=="standard"
        assert call("admin/invite-detail?id="+hcs["id"])["access_plan"]=="hcs"
        # Comped STANDARD is not a recorded payment. It may be replaced without falsifying revenue.
        request={"id":student_sid,"plan":"trial","period":None,"reason":"Test reset","expected_plan":"standard","expected_expires":changed["billing"]["expires"]}
        changed=call("admin/change-plan",request)
        assert changed["billing"]["plan"]=="FREE" and changed["trial"]["used"]["ai"]==0
        assert call("admin/subscriptions")["counts"]["paid_active"]==before["counts"]["paid_active"]
        # Confirm a real payment separately; an unexpired paid term cannot be silently removed.
        current=call("admin/subscription-payment",{"id":student_sid,"period":"month","paid_at":int(time.time()),"request_id":"20000000-0000-4000-8000-000000000001"})
        assert current["billing"]["basis"]=="paid"
        request={"id":student_sid,"plan":"vip","period":None,"reason":"","expected_plan":"standard","expected_expires":current["billing"]["expires"]}
        call("admin/change-plan",request,expected=409)
        with db() as conn:
            assert conn.execute("SELECT count(*) FROM subscription_payments WHERE user_id=?",(student,)).fetchone()[0]==prior_payments+1
            assert conn.execute("SELECT count(*) FROM account_notifications WHERE user_id=?",(student,)).fetchone()[0]==prior_notices+1
            assert conn.execute("SELECT count(*) FROM audit WHERE target=? AND action='change-plan'",(student,)).fetchone()[0]==prior_audit+5
            conn.execute("UPDATE users SET subscription_expires=? WHERE id=?",(int(time.time())-5,student))
        request["expected_expires"]=int(time.time())-5
        # Use the stored value, avoiding a test race across a second boundary.
        with db() as conn: request["expected_expires"]=conn.execute("SELECT subscription_expires FROM users WHERE id=?",(student,)).fetchone()[0]
        changed=call("admin/change-plan",request)
        assert changed["billing"]["plan"]=="VIP"
        with db() as conn:
            assert conn.execute("SELECT count(*) FROM account_notifications WHERE user_id=?",(student,)).fetchone()[0]==prior_notices+1
            assert conn.execute("SELECT count(*) FROM audit WHERE target=? AND action='change-plan'",(student,)).fetchone()[0]==prior_audit+6
            assert conn.execute("SELECT access_plan FROM invites WHERE public_id=?",(hcs["id"],)).fetchone()[0]=="hcs"
        assert call("admin/specialist-licenses?id="+student_sid)["items"][0]["license_number"]==hcs["license_number"]
        print("PASS: specialist license links, FREE/HCS/STANDARD/VIP switching, paid period guard, audit and payment integrity")
    finally:
        server.shutdown();server.server_close();t.join()
