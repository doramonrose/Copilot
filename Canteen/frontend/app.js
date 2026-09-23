(function(){
  'use strict';
  var app=document.getElementById('app'), token='', busy=false;
  var labels={PAID:['ชำระแล้ว','paid'],UNPAID:['ยังไม่ชำระ','unpaid'],LEAVE:['วันลา','leave'],UPCOMING:['ยังไม่ถึงกำหนด','upcoming'],NO_RECORD:['วันนี้ไม่มีรายการเรียกเก็บค่าเช่า','no-record']};
  function esc(value){var node=document.createElement('span');node.textContent=value==null?'':String(value);return node.innerHTML;}
  function status(key){var item=labels[key]||labels.NO_RECORD;return '<span class="status '+item[1]+'">'+item[0]+'</span>';}
  function apiError(result){var error=new Error(result&&result.error&&result.error.message||'เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง');error.code=result&&result.error&&result.error.code||'SERVER_ERROR';return error;}
  function withTimeout(promise,message){return Promise.race([promise,new Promise(function(resolve,reject){setTimeout(function(){reject(new Error(message));},15000);})]);}
  function call(action,params){
    if(busy)return Promise.reject(new Error('มีคำขอกำลังดำเนินการอยู่'));
    busy=true; params=params||{}; params.api=action; params.id_token=token;
    return new Promise(function(resolve,reject){
      var name='jsonp_'+Date.now()+'_'+Math.random().toString(36).slice(2), script=document.createElement('script');
      params.callback=name; window[name]=function(result){cleanup();resolve(result);};
      function cleanup(){busy=false;delete window[name];if(script.parentNode)script.parentNode.removeChild(script);}
      script.onerror=function(){cleanup();reject(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'));};
      script.src=window.APP_CONFIG.apiUrl+'?'+Object.keys(params).map(function(key){return encodeURIComponent(key)+'='+encodeURIComponent(params[key]);}).join('&');
      document.body.appendChild(script);
      setTimeout(function(){if(window[name]){cleanup();reject(new Error('เซิร์ฟเวอร์ไม่ตอบสนองภายใน 15 วินาที'));}},15000);
    });
  }
  function showError(message,code){var detail=code?' ['+code+']':'';app.innerHTML='<div class="shell"><div class="error">'+esc(message||'เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง')+esc(detail)+'</div><button class="button" id="retry">ลองใหม่</button></div>';document.getElementById('retry').onclick=boot;}
  function registration(){app.innerHTML='<div class="shell"><section class="panel"><p class="eyebrow">เริ่มต้นใช้งาน</p><h1 class="title">ลงทะเบียนผู้เช่าพื้นที่</h1><p class="muted">กรุณากรอกรหัสลงทะเบียนจากเจ้าหน้าที่</p><label for="code">รหัสลงทะเบียน</label><input id="code" class="input" maxlength="32" autocomplete="one-time-code"><div class="actions" style="margin-top:14px"><button class="button" id="register">ยืนยัน</button></div></section></div>';document.getElementById('register').onclick=async function(){var button=document.getElementById('register');button.disabled=true;try{var result=await call('register',{code:document.getElementById('code').value});if(!result.success){showError(result.error.message,result.error.code);button.disabled=false;return;}await loadDashboard();}catch(error){button.disabled=false;showError(error.message);}};}
  function buildCalendarHtml(items,todayKey){
    if(!items||!items.length)return '';
    var byDate={};items.forEach(function(item){byDate[item.date]=item;});
    var first=items[0].date,y=Number(first.slice(0,4)),m=Number(first.slice(5,7));
    var firstDow=new Date(Date.UTC(y,m-1,1)).getUTCDay();
    var daysInMonth=new Date(Date.UTC(y,m,0)).getUTCDate();
    var weekdayNames=['อา','จ','อ','พ','พฤ','ศ','ส'];
    var pad=function(n){return n<10?'0'+n:''+n;};
    var head=weekdayNames.map(function(w){return '<span class="cal-weekday">'+w+'</span>';}).join('');
    var cells='';
    for(var e=0;e<firstDow;e++)cells+='<span class="cal-day cal-day--empty"></span>';
    for(var d=1;d<=daysInMonth;d++){
      var key=y+'-'+pad(m)+'-'+pad(d);
      var item=byDate[key];
      var dow=(firstDow+d-1)%7;
      var isWeekend=dow===0||dow===6;
      var st=item?item.status:'NO_RECORD';
      var cls='cal-day';
      if(st==='PAID')cls+=' cal-day--paid';
      else if(st==='UNPAID')cls+=' cal-day--unpaid';
      else if(st==='LEAVE')cls+=' cal-day--leave';
      else if(isWeekend)cls+=' cal-day--weekend';
      else cls+=' cal-day--upcoming';
      if(key===todayKey)cls+=' cal-day--today';
      cells+='<span class="'+cls+'" title="'+esc(item?item.displayDate:key)+'">'+d+'</span>';
    }
    return '<section class="panel calendar-panel"><div class="section-heading"><div><span class="section-kicker">ปฏิทิน</span><h2>ปฏิทินการชำระ</h2></div></div><div class="cal-grid cal-head">'+head+'</div><div class="cal-grid">'+cells+'</div><div class="cal-legend"><span class="legend-item"><i class="legend-dot legend-dot--paid"></i>ชำระแล้ว</span><span class="legend-item"><i class="legend-dot legend-dot--unpaid"></i>ยังไม่ชำระ</span><span class="legend-item"><i class="legend-dot legend-dot--upcoming"></i>ยังไม่ถึงวันจ่าย</span><span class="legend-item"><i class="legend-dot legend-dot--leave"></i>วันลา/เสาร์-อาทิตย์</span></div></section>';
  }

  function dashboard(data){var t=data.today,s=data.summary;app.innerHTML='<div class="shell dashboard-shell"><header class="dashboard-top"><div class="brand-lockup"><div class="brand-mark">฿</div><div><p class="eyebrow">ค่าเช่ารายวันโรงอาหาร</p><h1 class="title">'+esc(data.shop.shopName)+'</h1></div></div><button class="icon-button" id="refresh" aria-label="รีเฟรชข้อมูล" title="รีเฟรชข้อมูล">↻</button></header><section class="today-card"><div class="today-copy"><span class="section-kicker">สถานะวันนี้</span><p class="today-date">'+esc(t.displayDate)+'</p><div>'+status(t.status)+'</div></div><div class="today-amount"><span>ค่าเช่าวันนี้</span><strong>'+(t.amount?esc(t.amount.toLocaleString('th-TH'))+' บาท':'-')+'</strong></div><div class="today-outstanding"><span>ยอดค้างชำระเดือนนี้</span><strong>'+s.unpaidAmount.toLocaleString('th-TH')+' บาท</strong></div></section>'+buildCalendarHtml(data.items,t.date)+'<section class="panel summary-panel"><div class="section-heading"><div><span class="section-kicker">ภาพรวม</span><h2>สรุปเดือนนี้</h2></div><span class="updated">อัปเดต '+esc(data.updatedAt)+' น.</span></div><div class="summary"><div class="metric metric-paid"><span class="metric-label">ชำระแล้ว</span><strong>'+s.paidDays+' <small>วัน</small></strong><em>'+s.paidAmount.toLocaleString('th-TH')+' บาท</em></div><div class="metric metric-unpaid"><span class="metric-label">ยังไม่ชำระ</span><strong>'+s.unpaidDays+' <small>วัน</small></strong><em>'+s.unpaidAmount.toLocaleString('th-TH')+' บาท</em></div><div class="metric metric-leave"><span class="metric-label">วันลา</span><strong>'+s.leaveDays+' <small>วัน</small></strong><em>ไม่คิดค่าเช่า</em></div><div class="metric metric-upcoming"><span class="metric-label">ยังไม่ถึงกำหนด</span><strong>'+s.futureDays+' <small>วัน</small></strong><em>รอดำเนินการ</em></div></div></section><section class="action-panel"><button class="button" id="history">ดูประวัติการชำระ</button><button class="button secondary" id="contact">ติดต่อเจ้าหน้าที่</button></section></div>';document.getElementById('refresh').onclick=loadDashboard;document.getElementById('history').onclick=loadHistory;document.getElementById('contact').onclick=function(){alert('กรุณาติดต่อเจ้าหน้าที่ผ่าน LINE Official Account');};}
  async function loadDashboard(){app.innerHTML='<div class="loading">กำลังโหลดข้อมูล...</div>';try{var result=await call('dashboard');if(!result.success){if(result.error.code==='USER_NOT_REGISTERED')return registration();throw apiError(result);}dashboard(result.data);}catch(error){showError(error.message,error.code);}}
  async function loadHistory(){app.innerHTML='<div class="loading">กำลังโหลดประวัติ...</div>';try{var months=await call('months');if(!months.success)throw apiError(months);var current=months.data[months.data.length-1]&&months.data[months.data.length-1].id;var history=await call('history',{month:current});if(!history.success)throw apiError(history);var options=months.data.map(function(month){return '<option value="'+esc(month.id)+'">'+esc(month.label)+'</option>';}).join('');app.innerHTML='<div class="shell"><header class="header"><h1 class="title">ประวัติการชำระ</h1><button class="button secondary" id="back">กลับ</button></header><select class="select" id="month" aria-label="เลือกเดือน">'+options+'</select><section class="panel" id="items"></section></div>';function render(items){document.getElementById('items').innerHTML=items.length?items.map(function(item){return '<div class="history-item"><div><strong>'+esc(item.displayDate)+'</strong><div>'+status(item.status)+'</div></div><div class="right">'+(item.amount?esc(item.amount.toLocaleString('th-TH'))+' บาท':'')+(item.receivedDate?'<div class="muted">รับเงิน '+esc(item.receivedDate)+'</div>':'')+'</div></div>';}).join(''):'<p class="muted">ยังไม่มีข้อมูลค่าเช่าในเดือนนี้</p>';};render(history.data.items);document.getElementById('month').onchange=async function(event){try{var result=await call('history',{month:event.target.value});if(!result.success)throw apiError(result);render(result.data.items);}catch(error){showError(error.message,error.code);}};document.getElementById('back').onclick=loadDashboard;}catch(error){showError(error.message,error.code);}}
  async function boot(){app.innerHTML='<div class="loading">กำลังเข้าสู่ระบบ...</div>';try{if(!window.APP_CONFIG.liffId||!window.APP_CONFIG.apiUrl)throw new Error('ยังไม่ได้ตั้งค่าระบบ');if(!window.liff||typeof liff.init!=='function')throw new Error('โหลด LINE LIFF SDK ไม่สำเร็จ กรุณาเปิดใหม่อีกครั้ง');await withTimeout(liff.init({liffId:window.APP_CONFIG.liffId}),'เชื่อมต่อ LINE ไม่สำเร็จภายใน 15 วินาที กรุณาตรวจสอบ LIFF Endpoint URL');if(!liff.isLoggedIn()){liff.login();return;}app.innerHTML='<div class="loading">กำลังตรวจสอบบัญชี...</div>';token=liff.getIDToken();if(!token)throw new Error('ไม่สามารถยืนยันตัวตนได้ กรุณาอนุญาตการเข้าสู่ระบบ LINE');await loadDashboard();}catch(error){showError(error.message,error.code);}}
  boot();
})();
