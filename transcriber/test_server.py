import unittest

import sys
import tempfile
from pathlib import Path

import server
from server import DefineError, cues_from_words, translate, srt_time, to_srt, transcript_path


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

        longer = " ".join(f"woord{i}" for i in range(30)) + " einde."
        texts = [c["text"] for c in cues_from_words(words(longer))]
        self.assertGreater(len(texts), 1)
        self.assertTrue(all(len(t.split()) > 2 for t in texts))

    def test_a_long_pause_ends_the_line(self):
        cues = cues_from_words(words("dit gaat zonder punt verder", 0) + words("en na de pauze.", 5))
        self.assertEqual([c["text"] for c in cues], ["dit gaat zonder punt verder", "en na de pauze."])

    def test_lines_hold_briefly_without_overlapping_the_next(self):
        cues = cues_from_words(words("Een.", 0) + words("Twee.", 0.5) + words("Drie.", 10))
        self.assertAlmostEqual(cues[0]["end"], 0.25)  # capped at the next line's (lead-in) start
        self.assertAlmostEqual(cues[1]["end"], 0.75 + 0.4)

    def test_lines_start_early_but_not_before_the_previous_speech_ends(self):
        # Whisper put "Supermensenontwijktraining." at 26.551 although it is spoken right after 25.311.
        cues = cues_from_words(words("Wat is er dan?", 24.4) + words("Supermensenontwijktraining.", 26.551))
        self.assertAlmostEqual(cues[1]["start"], 25.551)
        cues = cues_from_words(words("Wat is er dan?", 24.4) + words("Supermensenontwijktraining.", 25.6))
        self.assertAlmostEqual(cues[1]["start"], 24.4 + 0.9 + 0.25)  # the previous line's last word end
        self.assertAlmostEqual(cues_from_words(words("Een.", 0.3))[0]["start"], 0.0)

    def test_a_pause_never_leaves_a_fragment_of_a_sentence_on_its_own(self):
        cues = cues_from_words(words("En", 120) + words("toen nog een keertje, en nog een keer.", 122))
        self.assertEqual([c["text"] for c in cues], ["En toen nog een keertje, en nog een keer."])
        cues = cues_from_words(words("Ik ga echt naar", 0) + words("huis.", 2) + words("Hoi.", 3))
        self.assertEqual([c["text"] for c in cues], ["Ik ga echt naar huis.", "Hoi."])
        cues = cues_from_words(words("En", 0) + words("Veel later.", 20))
        self.assertEqual(len(cues), 2)  # too far apart, and a new sentence

    def test_a_fragment_whisper_timed_far_from_its_sentence_moves_to_it(self):
        cues = cues_from_words(words("Klaar.", 140) + words("We", 152) + words("gaan.", 195))
        self.assertEqual([c["text"] for c in cues], ["Klaar.", "We gaan."])
        self.assertAlmostEqual(cues[1]["start"], 195 - 0.25 - 1.0)  # placed just before "gaan.", plus the lead-in

    def test_filler_whisper_invents_over_music_is_dropped(self):
        lines = words("MUZIEK", 0) + words("nou nou nou nou nou nou", 5) + words("MUZIEK Goed verhaal.", 10)
        lines += [w for n in range(6) for w in words("Ik ben de enige.", 20 + n * 1.5)]
        self.assertEqual([c["text"] for c in cues_from_words(lines)], ["Goed verhaal.", "Ik ben de enige."])
        self.assertEqual(len(cues_from_words(words("Nee, nee, nee, nee, nee.", 0))), 1)  # real repetition stays


class Formatting(unittest.TestCase):
    def test_srt_time(self):
        self.assertEqual(srt_time(3723.0456), "01:02:03,046")

    def test_transcript_path_is_windows_safe(self):
        self.assertEqual(transcript_path('Invincible.S3.E1 - "Hi": you?').name, "Invincible.S3.E1 - _Hi__ you_.srt")
        with self.assertRaises(ValueError):
            transcript_path("  ")


class Translate(unittest.TestCase):
    def setUp(self):
        self.saved = dict(server.DEFINE_COMMANDS), server.DEFINE_PROVIDER, server.TRANSCRIPTS_DIR
        self.dir = tempfile.TemporaryDirectory()
        server.TRANSCRIPTS_DIR = Path(self.dir.name)
        server._translations.clear()

    def tearDown(self):
        server.DEFINE_COMMANDS.clear()
        server.DEFINE_COMMANDS.update(self.saved[0])
        server.DEFINE_PROVIDER = self.saved[1]
        server.TRANSCRIPTS_DIR = self.saved[2]
        self.dir.cleanup()

    def use(self, script):
        server.DEFINE_COMMANDS["stub"] = [sys.executable, "-c", script]
        server.DEFINE_PROVIDER = "stub"

    def test_returns_the_cli_answer_and_caches_it(self):
        self.use("import sys; print('EN ' + sys.stdin.read().rsplit('Sentence: ', 1)[1].strip())")
        self.assertEqual(translate("Hij zet de koffie op tafel."), "EN Hij zet de koffie op tafel.")

        self.use("raise SystemExit('should not run again')")
        self.assertEqual(translate("Hij zet de koffie op tafel. "), "EN Hij zet de koffie op tafel.")

    def test_a_failing_or_silent_cli_is_a_clear_error(self):
        self.use("raise SystemExit('not logged in')")
        with self.assertRaises(DefineError) as failed:
            translate("Hij zet.")
        self.assertEqual(failed.exception.status, 502)
        self.assertIn("not logged in", str(failed.exception))

        self.use("pass")
        with self.assertRaises(DefineError):
            translate("Hij zet.")


class StoredTranslations(Translate):
    def setUp(self):
        super().setUp()
        transcript_path("Ep.S1").write_text(
            to_srt([{"start": 1, "end": 2, "text": "Wat is er dan?"}, {"start": 2, "end": 4, "text": "Het is weird, man."}]),
            encoding="utf-8",
        )

    def test_the_whole_transcript_is_translated_once_and_lookups_use_it(self):
        self.use(r"import sys, re; print('\n'.join(f'{n}. EN {t}' for n, t in re.findall(r'^(\d+)\. (.+)$', sys.stdin.read(), re.M)))")
        self.assertEqual(server.translate_transcript("Ep.S1").name, "Ep.S1.en.ai.srt")

        self.use("raise SystemExit('should not be called')")
        self.assertEqual(translate("Het is  weird, man."), "EN Het is weird, man.")
        self.assertEqual(translate("Wat is er dan?\nHet is weird, man."), "EN Wat is er dan?\nEN Het is weird, man.")

    def test_a_supplied_english_srt_wins_and_is_matched_by_time(self):
        server.translation_paths("Ep.S1")[0].write_text(
            "1\n00:00:00,900 --> 00:00:02,100\nWhat's happening?\n\n2\n00:00:02,200 --> 00:00:04,300\nIt's weird, man.\n",
            encoding="utf-8",
        )
        self.use("raise SystemExit('should not be called')")
        self.assertEqual(server.translate_transcript("Ep.S1").name, "Ep.S1.en.srt")
        self.assertEqual(translate("Wat is er dan?"), "What's happening?")
        self.assertEqual(translate("Het is weird, man."), "It's weird, man.")

    def test_unknown_sentences_still_ask_the_cli(self):
        self.use("print('live')")
        self.assertEqual(translate("Iets anders."), "live")


class Http(Translate):
    def setUp(self):
        import threading
        from http.server import ThreadingHTTPServer

        super().setUp()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        server.jobs.clear()
        super().tearDown()

    def request(self, path, body=None):
        import urllib.request

        url = f"http://127.0.0.1:{self.httpd.server_port}{path}"
        return urllib.request.urlopen(urllib.request.Request(url, data=body, method="POST" if body is not None else "GET"), timeout=5)

    def test_job_status_is_served(self):
        import urllib.error

        with self.assertRaises(urllib.error.HTTPError) as missing:
            self.request("/jobs?key=Nothing")
        self.assertEqual(missing.exception.code, 404)

    def test_a_streamed_recording_is_on_disk_before_it_is_transcribed(self):
        import urllib.error
        from unittest import mock

        session = "0f8c2a1e-1111-2222-3333-444455556666"
        for chunk in (b"head", b"tail"):
            self.assertEqual(self.request(f"/append?key=Ep.S1&session={session}", chunk).status, 204)
        audio = server.streamed_audio_path("Ep.S1", session)
        self.assertEqual(audio.read_bytes(), b"headtail")

        with mock.patch.object(server, "run_job") as run_job:
            self.assertEqual(self.request(f"/transcribe?key=Ep.S1&session={session}&offset=38", b"").status, 202)
        run_job.assert_called_once_with("Ep.S1", audio, 38.0, False)

        with self.assertRaises(urllib.error.HTTPError) as bad:
            self.request("/append?key=Ep.S1&session=..%2Fescape", b"x")
        self.assertEqual(bad.exception.code, 400)


if __name__ == "__main__":
    unittest.main()
