const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'tests',testMatch:'*.spec.cjs',timeout:45000,fullyParallel:false,workers:1,
 reporter:[['list'],['html',{open:'never'}]],use:{baseURL:process.env.BASE_URL||'http://127.0.0.1:4173',screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[
  {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000},launchOptions:{executablePath:process.env.CHROME_BIN}}},
  {name:'phone-webkit',use:{...devices['iPhone 13'],launchOptions:{executablePath:process.env.WEBKIT_BIN}}}
 ],
 webServer:process.env.BASE_URL?undefined:{command:'node tools/serve.cjs',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI}
});
