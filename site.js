window.submitContact=async function(event){
  event.preventDefault();const form=event.target;const inputs=form.querySelectorAll('input');const button=form.querySelector('[type=submit]');
  button.disabled=true;button.textContent='Sending…';
  try{const response=await fetch('https://bamfit-contact-api.onrender.com/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name:inputs[0].value+' '+inputs[1].value,email:inputs[2].value,phone:inputs[3].value,interest:form.querySelector('select').value,message:form.querySelector('textarea').value})});
    if(!response.ok)throw new Error('Your message could not be saved. Please email contact@bamfit1.com.');
    button.textContent='Sent! Anthony will be in touch.';form.reset();
  }catch(error){button.textContent=error.message;}finally{button.disabled=false;}
};

const questionnaireComplete=localStorage.getItem('bamfit_questionnaire_complete')==='1';
const pricingGate=document.querySelector('[data-pricing-gate]');
const pricingDetails=document.querySelector('[data-pricing-details]');

if(pricingGate && pricingDetails){
  pricingGate.hidden=questionnaireComplete;
  pricingDetails.hidden=!questionnaireComplete;
}

document.querySelectorAll('[data-package]').forEach(link=>{
  const packageType=link.dataset.package;
  link.href=questionnaireComplete
    ? `checkout.html?package=${encodeURIComponent(packageType)}`
    : `index.html?signup=1&package=${encodeURIComponent(packageType)}`;
});

localStorage.removeItem('bamfit_api_key');
