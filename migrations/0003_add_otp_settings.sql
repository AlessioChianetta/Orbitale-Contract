
-- Add OTP settings columns to company_settings table
ALTER TABLE company_settings ADD COLUMN otp_method text DEFAULT 'email' NOT NULL;
ALTER TABLE company_settings ADD COLUMN twilio_account_sid text;
ALTER TABLE company_settings ADD COLUMN twilio_auth_token text;
ALTER TABLE company_settings ADD COLUMN twilio_verify_service_sid text;
ALTER TABLE company_settings ADD COLUMN twilio_whatsapp_from text;
