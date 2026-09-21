const status=document.getElementById('status'),button=document.getElementById('pay');
const API_BASE='https://bamfit-contact-api.onrender.com';
const checkoutForm=document.getElementById('checkout');
const questionnaireComplete=localStorage.getItem('bamfit_questionnaire_complete')==='1';

if(!questionnaireComplete){
  checkoutForm.querySelectorAll('input,select,button').forEach(control=>control.disabled=true);
  status.innerHTML='Complete the fitness questionnaire before choosing a package. <a href="index.html?signup=1">Start the questionnaire</a>.';
}else{
  fetch(API_BASE+'/api/payments/catalog').then(async response=>{if(!response.ok)throw new Error();const prices=await response.json();for(const price of prices){const option=document.createElement('option');option.value=price.id;option.textContent=`${price.label} — $${(price.amount/100).toFixed(2)}`;document.getElementById('package').appendChild(option);}const selected=new URLSearchParams(location.search).get('package');if(prices.some(p=>p.id===selected))document.getElementById('package').value=selected;button.disabled=false;}).catch(()=>status.innerHTML='Online booking is unavailable. <a href="mailto:contact@bamfit1.com">Email Anthony</a> to book.');
}
checkoutForm.onsubmit=async event=>{event.preventDefault();if(!questionnaireComplete)return;button.disabled=true;status.textContent='Opening secure checkout…';try{const response=await fetch(API_BASE+'/api/payments/create-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({package_type:document.getElementById('package').value,client_name:document.getElementById('name').value,client_email:document.getElementById('email').value})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Online booking is unavailable. Please contact Anthony.');location.assign(data.url);}catch(error){status.textContent=error.message;button.disabled=false;}};
