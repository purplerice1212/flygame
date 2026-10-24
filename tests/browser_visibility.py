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

if __name__=='__main__':unittest.main(verbosity=2)
