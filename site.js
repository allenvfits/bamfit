window.submitContact=async function(event){
  event.preventDefault();const form=event.target;const inputs=form.querySelectorAll('input');const button=form.querySelector('[type=submit]');
  button.disabled=true;button.textContent='Sending…';
  try{const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name:inputs[0].value+' '+inputs[1].value,email:inputs[2].value,phone:inputs[3].value,interest:form.querySelector('select').value,message:form.querySelector('textarea').value})});
    if(!response.ok)throw new Error('Your message could not be saved. Please email abiacono@gmail.com.');
    button.textContent='Sent! Anthony will be in touch.';form.reset();
  }catch(error){button.textContent=error.message;}finally{button.disabled=false;}
};
localStorage.removeItem('bamfit_api_key');
