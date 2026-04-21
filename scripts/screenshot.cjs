const { chromium } = require('playwright');

const SCREENSHOTS_DIR = 'docs/screenshots';

const PAGES = [
  { url: '/', name: 'dashboard', title: 'SYSTEM STATUS' },
  { url: '/sessions', name: 'sessions', title: 'SESSIONS' },
  { url: '/conversations', name: 'conversations', title: 'CHATS' },
  { url: '/skills', name: 'skills', title: 'SKILLS' },
  { url: '/memory', name: 'memory', title: 'MEMORY' },
  { url: '/crons', name: 'crons', title: 'CRON JOBS' },
  { url: '/jobs', name: 'jobs', title: 'JOBS' },
  { url: '/kanban', name: 'kanban', title: 'TASKS' },
  { url: '/plugins', name: 'plugins', title: 'PLUGINS' },
  { url: '/files', name: 'files', title: 'FILES' },
  { url: '/logs', name: 'logs', title: 'LOGS' },
  { url: '/profiles', name: 'profiles', title: 'PROFILES' },
  { url: '/multiagent', name: 'multiagent', title: 'MULTI-AGENT' },
  { url: '/config', name: 'config', title: 'CONFIGURATION' },
  { url: '/settings', name: 'settings', title: 'SETTINGS' },
];

// Fake data replacement functions per page
function fakeDashboard(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    
    const replacements = {
      'Ordenador-portatil-de-Anibal': 'hermes-node-01',
      'Anibal': 'Agent',
      '10.0.0.2': '10.0.0.42',
      '100.96.71.26': '100.64.0.42',
      '181.26.194.210': '203.0.113.42',
    };
    
    nodes.forEach(node => {
      let text = node.textContent;
      for (const [find, replace] of Object.entries(replacements)) {
        text = text.replaceAll(find, replace);
      }
      node.textContent = text;
    });
    
    // Fake session table
    const rows = main.querySelectorAll('tr');
    const fakeRows = [
      ['Weather report for New York City', 'API/WEB', '42', '18/4/2026'],
      ['Analyze sales data for Q1 2026', 'CLI', '28', '18/4/2026'],
      ['Daily digest - tech news summary', 'CRON', '4', '18/4/2026'],
      ['Scheduled backup verification', 'CRON', '5', '17/4/2026'],
      ['Weekly metrics report', 'CRON', '6', '17/4/2026'],
      ['Database optimization task', 'CRON', '4', '17/4/2026'],
      ['Log rotation and cleanup', 'CRON', '5', '17/4/2026'],
      ['Health check - all services', 'CRON', '4', '17/4/2026'],
    ];
    let ri = 0;
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4 && ri < fakeRows.length) {
        cells[0].textContent = fakeRows[ri][0];
        cells[1].textContent = fakeRows[ri][1];
        cells[2].textContent = fakeRows[ri][2];
        cells[3].textContent = fakeRows[ri][3];
        ri++;
      }
    });
    
    // Fake skill tags
    const fakeSkills = ['automation','autonomous-ai-agents','browser-use','creative','data-science','devops','email','github','mlops','research','media','productivity','smart-home','red-teaming','social-media','gaming','note-taking','dogfood','software-development','mcp'];
    const skillLinks = main.querySelectorAll('a[href="/skills"]');
    let si = 0;
    skillLinks.forEach(link => { if (si < fakeSkills.length) link.textContent = fakeSkills[si++]; });
  });
}

function fakeSessions(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const fakeTitles = ['Weather report for NYC','Analyze Q1 sales data','Deploy to staging env','Review PR #142','Weekly metrics report','Debug API timeout','Set up monitoring','Optimize DB queries','CI/CD pipeline setup','Market research analysis','Generate invoice report','Test auth module','Update dependencies','Refactor user service','CacheWarm cron job','Log cleanup job','Newsletter digest','Daily standup bot','Backup verification','Code review #89'];
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    
    nodes.forEach(node => {
      let t = node.textContent;
      t = t.replace(/Anibal/g, 'Agent');
      t = t.replace(/clima/gi, 'weather report');
      t = t.replace(/Gracie/g, 'ReportGen');
      t = t.replace(/10\.0\.0\.\d+/g, '10.0.0.42');
      t = t.replace(/100\.96\.\d+\.\d+/g, '100.64.0.42');
      t = t.replace(/181\.\d+\.\d+\.\d+/g, '203.0.113.42');
      node.textContent = t;
    });
    
    const links = main.querySelectorAll('a');
    let fi = 0;
    links.forEach(a => { if (a.href?.includes('/sessions/') && fi < fakeTitles.length) a.textContent = fakeTitles[fi++]; });
  });
}

function fakeGeneric(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      let t = node.textContent;
      t = t.replace(/Anibal/g, 'Agent');
      t = t.replace(/10\.0\.0\.\d+/g, '10.0.0.42');
      t = t.replace(/100\.96\.\d+\.\d+/g, '100.64.0.42');
      t = t.replace(/181\.\d+\.\d+\.\d+/g, '203.0.113.42');
      node.textContent = t;
    });
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  });
  
  for (const pg of PAGES) {
    console.log(`Capturing ${pg.name}...`);
    const page = await context.newPage();
    try {
      await page.goto(`http://localhost:23689${pg.url}`, { waitUntil: 'networkidle2', timeout: 15000 });
      await page.waitForTimeout(2000);
      
      // Apply fake data
      if (pg.name === 'dashboard') await fakeDashboard(page);
      else if (pg.name === 'sessions') await fakeSessions(page);
      else await fakeGeneric(page);
      
      // Wait a bit for DOM updates
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: `${SCREENSHOTS_DIR}/${pg.name}.png`,
        fullPage: false 
      });
      console.log(`  -> ${pg.name}.png saved`);
    } catch (e) {
      console.log(`  -> ERROR: ${e.message}`);
    } finally {
      await page.close();
    }
  }
  
  await browser.close();
  console.log('All screenshots captured!');
}

main().catch(e => { console.error(e); process.exit(1); });