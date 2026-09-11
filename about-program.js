'use strict';

(() => {
  const style=document.createElement('style');
  style.textContent=`
    .about-program-btn{width:100%!important;min-width:0!important;height:42px!important;margin:5px 0 0!important;border:1px solid #d4dde7!important;border-radius:8px!important;background:#f8fafc!important;color:#334155!important;font-weight:800!important;box-shadow:none!important}
    .about-program-btn:hover{background:#eef3f8!important}
    .about-program-divider{height:1px;background:#e2e8f0;margin:5px 2px 1px}
    .about-program-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}
    .about-program-dialog::backdrop{background:rgba(15,23,42,.5);backdrop-filter:blur(6px)}
    .about-program-window{width:min(720px,calc(100vw - 24px));max-height:88dvh;overflow:auto;background:#f8fafc;border:1px solid #d5dee8;border-radius:16px;box-shadow:0 25px 70px rgba(15,23,42,.35);padding:20px;box-sizing:border-box;color:#243447}
    .about-program-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}
    .about-program-head h2{margin:0;font-size:23px}
    .about-program-close{width:38px;height:38px;padding:0!important;border-radius:8px!important;font-size:18px!important}
    .about-program-version{font-size:12px;color:#7b8ba1;margin-bottom:16px}
    .about-program-section{padding:14px 15px;background:#fff;border:1px solid #dbe4ed;border-radius:11px;margin-top:10px;line-height:1.55;font-size:13px}
    .about-program-section h3{margin:0 0 8px;font-size:15px;color:#26384b}
    .about-program-section p{margin:6px 0}
    .about-program-section strong{color:#1f3348}
    .about-program-credits{display:grid;gap:8px}
    .about-program-person{padding:9px 10px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0}
    .about-program-license{font-size:12px;color:#475569}
    .about-program-license ol{margin:7px 0 0;padding-left:20px}
    .about-program-license li{margin:5px 0}
    .about-program-footer{display:flex;justify-content:flex-end;margin-top:14px}
    @media(max-width:640px){.about-program-window{padding:14px;border-radius:14px}.about-program-head h2{font-size:20px}}
  `;
  document.head.appendChild(style);

  const dlg=document.createElement('dialog');
  dlg.className='about-program-dialog';
  dlg.innerHTML=`
    <div class="about-program-window">
      <div class="about-program-head">
        <h2>О программе</h2>
        <button type="button" class="tk-btn about-program-close">×</button>
      </div>
      <div class="about-program-version">Психологическая диагностика · Diagnostika_SS</div>

      <section class="about-program-section">
        <h3>Разработка</h3>
        <p><strong>Автор идеи, разработчик и развитие программы:</strong><br>Прудников Е.С.</p>
      </section>

      <section class="about-program-section">
        <h3>Методическая помощь и благодарности</h3>
        <div class="about-program-credits">
          <div class="about-program-person"><strong>Дмитрий Коршевнюк</strong><br>Кандидат медицинских наук, врач‑психотерапевт, психофизиолог, гипнотерапевт. Методическая опора и идеи, повлиявшие на формирование логики исходной диагностической таблицы и подхода к работе с материалом клиента.</div>
          <div class="about-program-person"><strong>Аркадий Ильиных</strong><br>Маркетолог и бизнес‑архитектор. Идеи и практические подходы, повлиявшие на структуру, прикладное использование и развитие исходной системы.</div>
        </div>
        <p style="margin-top:10px;color:#64748b">Указанные специалисты не являются разработчиками программного кода. Их вклад относится к идеям, обучению, методическим и практическим подходам, использованным при развитии исходной таблицы.</p>
      </section>

      <section class="about-program-section about-program-license">
        <h3>Лицензия на использование</h3>
        <p>© 2026 Прудников Е.С. Авторские права на программу и её оригинальную структуру принадлежат разработчику.</p>
        <ol>
          <li>Программу разрешается бесплатно использовать в личной и профессиональной практике.</li>
          <li>Разрешается создавать резервные копии и переносить программу между собственными устройствами.</li>
          <li>Запрещается продавать программу, её копии или предоставлять доступ к ней за плату без письменного разрешения автора.</li>
          <li>Запрещается выдавать программу, её интерфейс или оригинальную структуру за собственную разработку.</li>
          <li>При распространении неизменённой копии должна сохраняться информация об авторе и данный раздел «О программе».</li>
          <li>Изменение программы для собственных нужд допускается, но распространение изменённых версий от имени автора требует его согласия.</li>
          <li>Программа предоставляется «как есть». Автор не гарантирует отсутствие ошибок и не несёт ответственности за решения специалиста, принятые на основании внесённых в программу данных.</li>
        </ol>
      </section>

      <div class="about-program-footer"><button type="button" class="tk-btn about-program-close-bottom">Закрыть</button></div>
    </div>`;
  document.body.appendChild(dlg);

  const close=()=>dlg.open&&dlg.close();
  dlg.querySelector('.about-program-close').addEventListener('click',close);
  dlg.querySelector('.about-program-close-bottom').addEventListener('click',close);
  dlg.addEventListener('click',e=>{if(e.target===dlg)close();});

  function install(){
    const panel=document.querySelector('#settingsPanel');
    if(!panel||panel.querySelector('#aboutProgramBtn'))return false;
    const divider=document.createElement('div');divider.className='about-program-divider';
    const btn=document.createElement('button');
    btn.type='button';btn.id='aboutProgramBtn';btn.className='tk-btn about-program-btn';btn.textContent='ℹ О программе';
    panel.append(divider,btn);
    btn.addEventListener('click',()=>dlg.showModal());
    return true;
  }

  if(!install()){
    const mo=new MutationObserver(()=>{if(install())mo.disconnect();});
    mo.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>{install();},0);
  }
})();
