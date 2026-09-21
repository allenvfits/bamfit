const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const publicPages=['index.html','about.html','pricing.html','results.html','checkout.html','owner.html','success.html'];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('public pages have unique ids, valid inline JavaScript, and resolvable local assets',()=>{
  for(const file of publicPages){
    const source=read(file);
    const ids=[...source.matchAll(/\bid=["']([^"']+)["']/gi)].map(match=>match[1]);
    assert.equal(new Set(ids).size,ids.length,`${file} contains duplicate ids`);

    for(const match of source.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
      assert.doesNotThrow(()=>new vm.Script(match[1],{filename:file}),`${file} contains invalid inline JavaScript`);
    }

    for(const match of source.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)){
      const target=match[1];
      if(/^(?:https?:|mailto:|tel:|data:)/i.test(target))continue;
      if(target.startsWith('#')){
        assert.ok(ids.includes(target.slice(1)),`${file} references missing ${target}`);
        continue;
      }
      const localPath=target.split(/[?#]/,1)[0];
      if(!localPath)continue;
      assert.ok(fs.existsSync(path.resolve(root,localPath)),`${file} references missing ${localPath}`);
      const fragment=target.includes('#')?target.slice(target.indexOf('#')+1):'';
      if(fragment && localPath.endsWith('.html')){
        assert.match(read(localPath),new RegExp(`\\bid=["']${fragment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["']`),`${file} references missing #${fragment} in ${localPath}`);
      }
    }
  }
});

test('public browser scripts have valid JavaScript syntax',()=>{
  for(const file of ['site.js','checkout-ui.js','owner-ui.js']){
    assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}),`${file} contains invalid JavaScript`);
  }
});

test('checkout and owner tools use the protected Render API',()=>{
  for(const file of ['checkout-ui.js','owner-ui.js']){
    assert.match(read(file),/https:\/\/bamfit-contact-api\.onrender\.com/,`${file} does not target the API service`);
  }
});

test('homepage stays visible until a visitor explicitly starts signup',()=>{
  const home=read('index.html');
  assert.match(home,/<body>/);
  assert.match(home,/class="gate hidden" id="questionnaire"/);
  assert.match(home,/get\('signup'\)==='1'/);
  assert.doesNotMatch(home,/sessionStorage\.getItem\('bamfit_questionnaire_skipped'\)/);
  assert.match(home,/id="closeQuestionnaire"/);
});

test('questionnaire gates pricing and checkout',()=>{
  const pricing=read('pricing.html');
  const checkout=read('checkout-ui.js');
  assert.match(pricing,/data-pricing-gate/);
  assert.match(pricing,/data-pricing-details hidden/);
  assert.match(pricing,/index\.html\?signup=1/);
  assert.match(checkout,/bamfit_questionnaire_complete/);
  assert.match(checkout,/Complete the fitness questionnaire/);
});

test('only the three approved training packages are public and purchasable',()=>{
  const prices=require('../prices');
  assert.deepEqual(Object.keys(prices).sort(),['6_sessions','10_sessions','15_sessions'].sort());

  const pricing=read('pricing.html');
  for(const approved of ['$265','$420','$600'])assert.match(pricing,new RegExp(approved.replace('$','\\$')));
  assert.ok(!pricing.includes('>$952<'),'pricing.html still displays the retired 25-session price');
});

test('stretching, nutrition, and custom-routine links lead to a working contact path',()=>{
  const home=read('index.html');
  const pricing=read('pricing.html');
  assert.match(home,/href="pricing\.html#pnf"/);
  assert.match(pricing,/id="pnf"/);
  assert.ok(pricing.indexOf('<section id="pnf">')>pricing.indexOf('</main>'),'PNF options must stay visible without the training questionnaire');
  for(const choice of ['intro_25','session_25','session_50','nutrition','custom']){
    assert.match(pricing,new RegExp(`index\\.html\\?interest=${choice}#contact`));
    assert.match(home,new RegExp(`value="${choice}"`));
  }
  for(const price of ['$25','$35','$60','$100'])assert.ok(pricing.includes(`>${price}<`)||pricing.includes(`${price} monthly`));
});

test('signup calls to action on secondary pages start the questionnaire',()=>{
  for(const file of ['about.html','pricing.html','results.html']){
    assert.match(read(file),/href="index\.html\?signup=1"[^>]*class="nav-cta"/,`${file} bypasses signup from its main call to action`);
  }
});

test('every results filter has at least one matching result card',()=>{
  const results=read('results.html');
  const filters=[...results.matchAll(/filterCards\('([^']+)'/g)].map(match=>match[1]).filter(category=>category!=='all');
  const cardCategories=[...results.matchAll(/class="[^"]*story-card[^"]*"[^>]*data-cat="([^"]+)"/g)]
    .flatMap(match=>match[1].split(/\s+/));
  for(const filter of filters)assert.ok(cardCategories.includes(filter),`results filter ${filter} has no matching card`);
});

test('results page does not show inactive video controls',()=>{
  const results=read('results.html');
  assert.doesNotMatch(results,/class="play-btn"/);
  assert.match(results,/video stories are coming soon/i);
});
