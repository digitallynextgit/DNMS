-- A punch terminal on DHCP moves address whenever its lease does, and the app
-- then calls whatever else now holds the old one - which answers 404, or a
-- timeout, or someone else's 401. Recording the device's own identity lets it be
-- recognised, and found again, independently of where it currently sits.
ALTER TABLE "hikvision_devices" ADD COLUMN "hardware_serial" TEXT;
ALTER TABLE "hikvision_devices" ADD COLUMN "mac_address"     TEXT;
