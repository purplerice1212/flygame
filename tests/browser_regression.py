"""Real Chromium UI/AI regressions. CI uses HTTP and real browser localStorage.
FLYCHESS_INLINE=1 supports restricted visual checks; storage tests are explicitly
skipped in that mode, never replaced with a mock storage backend.
"""
import functools
import http.server
import json
import os
from pathlib import Path
import re
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('FLYCHESS_EVIDENCE',str(ROOT/'test-results')))
INLINE=os.environ.get('FLYCHESS_INLINE')=='1'
OUT.mkdir(parents=True,exist_ok=True)
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
class BrowserRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        executable=os.environ.get('CHROMIUM_PATH')
        cls.browser=cls.pw.chromium.launch(headless=True,**({'executable_path':executable} if executable else {}))
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
        cls.url=f'http://127.0.0.1:{cls.server.server_port}/skybound_flight_chess_interface.html'
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.html=(ROOT/'skybound_flight_chess_interface.html').read_text()
        if INLINE:
            cls.html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m[1]).read_text()+'</style>',cls.html)
            cls.html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(ROOT/m[1]).read_text()+'</script>',cls.html)
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1440,'height':1080},reduced_motion='reduce',accept_downloads=True)
        self.page=self.context.new_page();self.page.set_default_timeout(8000)
        self.errors=[]
        self.page.on('console',lambda m:print(m.text,flush=True) if m.text.startswith('SIM ') else None)
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.clock.install()
        if INLINE:self.page.set_content(self.html,wait_until='load')
        else:self.page.goto(self.url,wait_until='load')
    def tearDown(self):
        if self.errors:self.page.screenshot(path=str(OUT/(self._testMethodName+'-error.png')),full_page=True)
        self.context.close();self.assertEqual(self.errors,[],'Browser JavaScript exceptions')
    def start(self,count=2,types=None,preset='custom'):
        self.page.locator('#playerCount').select_option(str(count))
        for i in range(count):self.page.locator('[data-player-card]').nth(i).locator('[data-type]').select_option((types or ['human']*count)[i])
        self.page.locator(f'input[name="preset"][value="{preset}"]').check()
        self.page.locator('#btn-start').click();self.page.clock.fast_forward(400)
        self.assertEqual(self.page.evaluate('App.state.view'),'game');self.assertTrue(self.page.evaluate('App.state.boardAudit.ok'))
    def dice(self,value):
        self.page.evaluate('(v)=>{window.__realRandom=Math.random;Math.random=()=> (v-0.5)/6;}',value)
        self.page.locator('#btn-roll').click();self.page.evaluate('Math.random=window.__realRandom')
    def move(self,index=0):
        self.page.locator('#movables button').nth(index).click();self.page.clock.run_for(600)
    def fixture(self,js):
        self.page.evaluate('App.cancelPendingActions();App.state.dice=null;App.state.legalMoves=[];'+js+';App.redrawPieces();App.updateTurnUI();');self.page.clock.fast_forward(400)
    def test_01_mouse_move_and_undo(self):
        self.start();self.dice(2);self.assertGreater(self.page.locator('#movables button').count(),0);self.move()
        self.assertEqual(self.page.evaluate('App.state.pieces.P1[0].pos.kind'),'track')
        self.page.locator('#btn-undo').click();self.assertEqual(self.page.evaluate('App.state.pieces.P1[0].pos.kind'),'base');self.assertEqual(self.page.evaluate('App.state.dice'),2)
    def test_02_keyboard_loop(self):
        self.start();self.page.evaluate('Math.random=()=>0.2');self.page.keyboard.press('Space');self.page.keyboard.press('1');self.page.clock.run_for(600)
        self.assertEqual(self.page.evaluate('App.state.pieces.P1[0].pos.kind'),'track');self.page.keyboard.press('u');self.assertEqual(self.page.evaluate('App.state.pieces.P1[0].pos.kind'),'base')
    def test_03_animation_cannot_mutate_restarted_game(self):
        self.page.emulate_media(reduced_motion='no-preference');self.start();self.dice(2);self.page.locator('#movables button').first.click()
        self.assertTrue(self.page.evaluate('App.state.animating'));self.page.locator('#btn-restart').click();self.page.clock.run_for(1600)
        self.assertTrue(self.page.evaluate("Object.values(App.state.pieces).flat().every(p=>p.pos.kind==='base')"));self.assertEqual(self.page.evaluate('App.state.turn'),'P1')
    def test_04_stale_no_move_timer_cancelled_on_restart(self):
        self.start();self.dice(1);self.page.locator('#btn-restart').click();self.page.clock.run_for(1600)
        self.assertEqual(self.page.evaluate('App.state.turn'),'P1');self.assertIsNone(self.page.evaluate('App.state.dice'))
    def test_05_capture_returns_enemy_to_its_slot(self):
        self.start();self.fixture("App.state.rules.ownColorJump.enabled=false;App.state.rules.dashedFlight.enabled=false;App.state.rules.specials.enabled=false;App.state.pieces.P1[0].pos=GameRules.Pos.track(4);App.state.pieces.P2[0].pos=GameRules.Pos.track(5)")
        self.dice(1);self.move();self.assertEqual(self.page.evaluate('App.state.pieces.P2[0].pos'),{'kind':'base','slot':0});self.assertEqual(self.page.evaluate('App.state.pieces.P1[0].pos.idx'),5)
    def test_06_trap_skips_rotation_not_immediate_extra_roll(self):
        self.start();self.fixture("App.state.rules.ownColorJump.enabled=false;App.state.rules.dashedFlight.enabled=false;App.state.pieces.P1[0].pos=GameRules.Pos.track(6)")
        self.dice(6);self.move();self.assertEqual(self.page.evaluate('App.state.turn'),'P1');self.assertEqual(self.page.evaluate('App.state.skipTurns.P1'),1)
        self.dice(1);self.move();self.assertEqual(self.page.evaluate('App.state.turn'),'P2')
        self.dice(1);self.page.clock.run_for(1600);self.assertEqual(self.page.evaluate('App.state.turn'),'P2');self.assertEqual(self.page.evaluate('App.state.skipTurns.P1'),0)
    def test_07_winner_dialog_and_restart(self):
        self.start();self.fixture("App.state.pieces.P1.slice(0,3).forEach(p=>p.pos=GameRules.Pos.finished());App.state.pieces.P1[3].pos=GameRules.Pos.home(4)")
        self.dice(1);self.move();self.assertTrue(self.page.locator('#dialog-victory').is_visible());self.assertEqual(self.page.evaluate('App.state.winner'),'P1')
        self.page.locator('#dialog-victory [data-action="restart"]').click();self.assertTrue(self.page.evaluate("Object.values(App.state.pieces).flat().every(p=>p.pos.kind==='base')"));self.assertIsNone(self.page.evaluate('App.state.winner'))
    def test_08_duplicate_colours_do_not_start(self):
        self.page.locator('[data-player-card]').nth(1).locator('[data-color]').select_option('red');self.page.locator('#btn-start').click();self.assertEqual(self.page.evaluate('App.state.view'),'lobby')
    def test_09_ai_timer_is_deduplicated_and_each_difficulty_moves(self):
        for difficulty in ['easy','normal','hard']:
            if self.page.evaluate('App.state.view')=='game':self.page.locator('#btn-lobby').click()
            self.page.locator('[data-player-card]').first.locator('[data-type]').select_option('ai')
            self.page.locator('[data-player-card]').first.locator('[data-difficulty]').select_option(difficulty)
            self.page.evaluate('Math.random=()=>0.2');self.start(types=['ai','human']);self.page.evaluate('for(let i=0;i<20;i++)App.maybeAutoPlayIfAI()');self.page.clock.run_for(1800)
            self.assertEqual(self.page.evaluate("App.state.pieces.P1.filter(p=>p.pos.kind!=='base').length"),1);self.assertEqual(self.page.evaluate('App.state.turn'),'P2')
    def test_10_themes_debug_overlay_and_mobile_layout(self):
        self.start(4)
        for width in [320,390,768,1440]:
            self.page.set_viewport_size({'width':width,'height':1080 if width>700 else 844});self.page.clock.run_for(350)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            self.page.locator('#btn-settings').click();self.assertLessEqual(self.page.locator('#dialog-settings').bounding_box()['width'],width);self.page.locator('#dialog-settings button[value="cancel"]').click()
        for theme in ['light','high','dark']:
            self.page.locator('#btn-settings').click();self.page.locator('#theme').select_option(theme);self.page.locator('#board-debug').check();self.page.locator('#dialog-settings button[value="cancel"]').click()
            self.assertEqual(self.page.locator('.board-debug text').count(),52);self.assertTrue(self.page.evaluate('App.state.boardAudit.ok'))
            self.page.locator('svg.board').screenshot(path=str(OUT/f'board-{theme}.png'))
        self.page.locator('#btn-settings').click();self.page.locator('#board-debug').uncheck();self.page.locator('#dialog-settings button[value="cancel"]').click()
        self.page.evaluate("App.cancelPendingActions(); App.showTurnPrompt('');")
        self.page.locator('svg.board').screenshot(path=str(OUT/'board.png'));self.page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
        self.page.set_viewport_size({'width':390,'height':844});self.page.clock.run_for(350);self.page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
    @unittest.skipIf(INLINE,'real persistence requires a hosted origin; exercised in CI')
    def test_11_real_save_reload_and_corrupt_save(self):
        self.start();self.dice(2);self.move();self.assertTrue(self.page.evaluate('App.saveGame()'));before=self.page.evaluate('JSON.stringify(App.state.pieces)')
        self.page.reload(wait_until='load');self.page.locator('#btn-continue').click();self.assertEqual(self.page.evaluate('JSON.stringify(App.state.pieces)'),before)
        self.page.evaluate("localStorage.setItem('ac_save_v1','corrupt')");self.page.reload(wait_until='load');self.assertTrue(self.page.locator('#btn-continue').is_disabled());self.assertEqual(self.page.evaluate("localStorage.getItem('ac_save_v1')"),'corrupt')
    @unittest.skipIf(INLINE,'native download/import tested on the hosted origin in CI')
    def test_12_export_and_import_save_file(self):
        self.start();self.dice(2);self.move();before=self.page.evaluate('JSON.stringify(App.state.pieces)');self.page.locator('#btn-settings').click()
        with self.page.expect_download() as download:self.page.locator('#btn-export').click()
        file=OUT/'exported-save.json';download.value.save_as(file);self.assertEqual(json.loads(file.read_text())['version'],'skybound-variant-v2')
        self.page.locator('#dialog-settings button[value="cancel"]').click();self.page.locator('#btn-restart').click();self.page.locator('#btn-settings').click();self.page.locator('#save-import').set_input_files(str(file))
        self.page.wait_for_function("!document.querySelector('#dialog-settings').open");self.assertEqual(self.page.evaluate('JSON.stringify(App.state.pieces)'),before)
    def test_13_dialog_blocks_keyboard_and_pauses_timer(self):
        self.start();self.page.evaluate('App.state.rules.turnTimerSec=1;App.beginTurnTimer();Math.random=()=>0.2')
        self.page.locator('#btn-settings').click();self.page.keyboard.press('Space');self.page.clock.run_for(3000);self.assertIsNone(self.page.evaluate('App.state.dice'))
        self.page.locator('#dialog-settings button[value="cancel"]').click();self.page.clock.run_for(1200);self.assertIsNotNone(self.page.evaluate('App.state.dice'))
    def test_14_plane_art_is_centred_and_grid_tiles_not_rotated(self):
        self.start(4);self.assertEqual(self.page.locator('#layer-pieces use.plane-token').count(),16)
        self.assertTrue(self.page.evaluate("[...document.querySelectorAll('use.plane-token')].every(n=>n.getAttribute('x')==='0'&&n.getAttribute('y')==='0')"));self.assertEqual(self.page.locator('[data-track-index]').count(),52)
        self.assertTrue(self.page.evaluate("[...document.querySelectorAll('[data-tile-face]')].every(n=>!n.hasAttribute('transform'))"))
    def test_15_twenty_seeded_ai_selected_complete_games(self):
        self.start(4)
        results=self.page.evaluate('''async()=>{
          const results=[];
          for(let run=0;run<20;run++){
            console.log('SIM start '+run);
            let seed=run+1;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
            const count=2+run%3,difficulty=['easy','normal','hard'][run%3];
            App.toLobby();App.$.playerCount.value=String(count);App.renderLobbyPlayers(count);
            App.$.playerList.querySelectorAll('[data-type]').forEach(n=>n.value='human');
            App.$.formSetup.querySelector('input[name="preset"][value="custom"]').checked=true;
            App.startGame();App.applyPreset(['classic','fast','family','custom'][run%4]);
            let steps=0;
            while(App.state.turn&&steps<2400){
              document.querySelectorAll('dialog[open]').forEach(d=>d.close());
              if(App.state.dice==null)App.rollDice('system');
              if(App.state.dice==null){steps++;continue;}
              if(App.state.legalMoves.length){
                const move=App.chooseAIMove({difficulty});
                if(!App.state.legalMoves.includes(move))throw new Error('AI selected a non-legal move');
                await App.applyMove(move,'system');
              }else App.finishNoMoveTurn();
              steps++;
            }
            if(App.state.turn||App.state.finishOrder.length!==count)throw new Error('Incomplete game '+run+' after '+steps+' actions');
            console.log('SIM completed '+run+' actions '+steps);
            results.push({seed:run+1,players:count,difficulty,preset:['classic','fast','family','custom'][run%4],actions:steps,winner:App.state.winner});
            App.cancelPendingActions();
          }
          return results;
        }''')
        (OUT/'complete-games.json').write_text(json.dumps(results,indent=2));self.assertEqual(len(results),20)
if __name__=='__main__':unittest.main(verbosity=2)
