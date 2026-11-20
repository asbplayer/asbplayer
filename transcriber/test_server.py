import unittest

from server import cues_from_words, srt_time, transcript_path


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


if __name__ == "__main__":
    unittest.main()
