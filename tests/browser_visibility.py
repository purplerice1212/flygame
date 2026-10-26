"""Additional real-browser regressions for native hidden-attribute semantics."""
import unittest
import browser_regression as base

class VisibilityRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base.BrowserRegression.setUpClass()
    @classmethod
    def tearDownClass(cls):
        base.BrowserRegression.tearDownClass()
    def setUp(self):
        self.fixture=base.BrowserRegression(methodName='runTest')
        self.fixture.setUp()
        self.page=self.fixture.page
    def tearDown(self):
        self.fixture.tearDown()
    def test_lobby_and_game_are_mutually_exclusive(self):
        self.assertTrue(self.page.locator('#view-lobby').is_visible())
        self.assertFalse(self.page.locator('#view-game').is_visible())
        self.fixture.start(4)
        self.assertFalse(self.page.locator('#view-lobby').is_visible())
        self.assertTrue(self.page.locator('#view-game').is_visible())
        self.assertGreater(self.page.locator('svg.board').bounding_box()['width'],600)
        self.page.locator('#btn-lobby').click()
        self.assertTrue(self.page.locator('#view-lobby').is_visible())
        self.assertFalse(self.page.locator('#view-game').is_visible())
    def test_human_difficulty_controls_stay_hidden(self):
        first=self.page.locator('[data-player-card]').first
        first.locator('[data-type]').select_option('human')
        self.assertFalse(first.locator('[data-difficulty-row]').is_visible())
        first.locator('[data-type]').select_option('ai')
        self.assertTrue(first.locator('[data-difficulty-row]').is_visible())
        first.locator('[data-type]').select_option('human')
        self.assertFalse(first.locator('[data-difficulty-row]').is_visible())
        self.assertFalse(self.page.locator('#save-import').is_visible())

    def test_navigation_keeps_board_visible_and_prompt_out_of_board(self):
        for width in (320,390,768,1440):
            with self.subTest(width=width):
                self.page.set_viewport_size({'width':width,'height':844})
                self.fixture.start()
                self.assertEqual(self.page.evaluate('window.scrollY'),0)
                board=self.page.locator('.board-wrap').bounding_box()
                self.assertGreaterEqual(board['y'],0)
                self.assertLess(board['y'],240)
                # The independently released fixed turn popup must not block input.
                self.assertEqual(self.page.evaluate(
                    "getComputedStyle(document.querySelector('#turn-banner')).pointerEvents"),'none')
                self.page.evaluate('window.scrollTo(0,document.body.scrollHeight)')
                self.page.evaluate('App.toLobby()')
                self.page.clock.fast_forward(80)
                self.assertEqual(self.page.evaluate('window.scrollY'),0)

if __name__=='__main__':unittest.main(verbosity=2)
