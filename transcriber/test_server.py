import unittest

import sys

import server
from server import DefineError, cues_from_words, define, srt_time, transcript_path


def words(text, start=0.0, step=0.3):
    return [{"word": " " + w, "start": start + i * step, "end": start + i * step + 0.25} for i, w in enumerate(text.split())]


class CuesFromWords(unittest.TestCase):
    def test_one_line_per_sentence(self):
        cues = cues_from_words(words("Goedemiddag. Dit is het journaal."))
        self.assertEqual([c["text"] for c in cues], ["Goedemiddag.", "Dit is het journaal."])

    def test_long_sentence_is_split_but_never_leaves_a_short_orphan(self):
        long = "Het gaat over een WhatsApp-groep waarin mannen foto's deelden van billen en borsten van vrouwen."
        cues = cues_from_words(words(long))
        self.assertEqual([c["text"] for c in cues], [long])

        longer = " ".join(["woord"] * 30) + " einde."
        texts = [c["text"] for c in cues_from_words(words(longer))]
        self.assertGreater(len(texts), 1)
        self.assertTrue(all(len(t.split()) > 2 for t in texts))

    def test_a_long_pause_ends_the_line(self):
        cues = cues_from_words(words("zonder punt", 0) + words("na de pauze.", 5))
        self.assertEqual([c["text"] for c in cues], ["zonder punt", "na de pauze."])

    def test_lines_hold_briefly_without_overlapping_the_next(self):
        cues = cues_from_words(words("Een.", 0) + words("Twee.", 0.5) + words("Drie.", 10))
        self.assertAlmostEqual(cues[0]["end"], 0.5)  # capped at the next line's start
        self.assertAlmostEqual(cues[1]["end"], 0.75 + 0.4)


class Formatting(unittest.TestCase):
    def test_srt_time(self):
        self.assertEqual(srt_time(3723.0456), "01:02:03,046")

    def test_transcript_path_is_windows_safe(self):
        self.assertEqual(transcript_path('Invincible.S3.E1 - "Hi": you?').name, "Invincible.S3.E1 - _Hi__ you_.srt")
        with self.assertRaises(ValueError):
            transcript_path("  ")


class Define(unittest.TestCase):
    def setUp(self):
        self.saved = dict(server.DEFINE_COMMANDS), server.DEFINE_PROVIDER
        server._definitions.clear()

    def tearDown(self):
        server.DEFINE_COMMANDS.clear()
        server.DEFINE_COMMANDS.update(self.saved[0])
        server.DEFINE_PROVIDER = self.saved[1]

    def use(self, script):
        server.DEFINE_COMMANDS["stub"] = [sys.executable, "-c", script]
        server.DEFINE_PROVIDER = "stub"

    def test_returns_the_cli_answer_and_caches_it(self):
        self.use("import sys; print('meaning of ' + sys.stdin.read().rsplit('Word: ', 1)[1].strip())")
        self.assertEqual(define("zet", "Hij zet de koffie op tafel."), "meaning of zet")

        self.use("raise SystemExit('should not run again')")
        self.assertEqual(define("Zet ", "Hij zet de koffie op tafel."), "meaning of zet")

    def test_a_failing_or_silent_cli_is_a_clear_error(self):
        self.use("raise SystemExit('not logged in')")
        with self.assertRaises(DefineError) as failed:
            define("zet", "Hij zet.")
        self.assertEqual(failed.exception.status, 502)
        self.assertIn("not logged in", str(failed.exception))

        self.use("pass")
        with self.assertRaises(DefineError):
            define("zet", "Hij zet.")

    def test_sentence_translation_is_independent_of_word_definition(self):
        self.use("import sys; prompt = sys.stdin.read(); print('translation' if 'Translate the following sentence' in prompt else 'definition')")
        self.assertEqual(define('', 'Hij zet.'), 'translation')
        self.assertEqual(define('zet', 'Hij zet.'), 'definition')


if __name__ == "__main__":
    unittest.main()
