-- Amplitude peaks (0-100) captured while the voice note was being recorded.
-- Storing them means the player draws a true waveform immediately, instead of
-- downloading the whole clip and decoding it in the browser just to draw bars.
ALTER TABLE "chat_attachments"
  ADD COLUMN "waveform" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
