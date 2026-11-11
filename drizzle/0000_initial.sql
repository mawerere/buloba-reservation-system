CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" varchar(80) NOT NULL,
	"module" varchar(48) NOT NULL,
	"details" text NOT NULL,
	"staff_id" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"guest_id" integer NOT NULL,
	"room_number" integer NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"guests_count" integer DEFAULT 1 NOT NULL,
	"status" varchar(24) DEFAULT 'Reserved' NOT NULL,
	"nightly_rate" integer NOT NULL,
	"notes" text,
	"actual_check_in" timestamp with time zone,
	"actual_check_out" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(32) NOT NULL,
	CONSTRAINT "bookings_dates_valid" CHECK ("bookings"."check_out" > "bookings"."check_in"),
	CONSTRAINT "bookings_guests_positive" CHECK ("bookings"."guests_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "folio_charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer,
	"room_number" integer,
	"guest_name" varchar(160) NOT NULL,
	"department" varchar(32) NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar(20) DEFAULT 'Open' NOT NULL,
	"receipt_id" integer,
	"created_by" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folio_charges_amount_positive" CHECK ("folio_charges"."amount" > 0),
	CONSTRAINT "folio_charges_quantity_positive" CHECK ("folio_charges"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"phone" varchar(40) NOT NULL,
	"nationality" varchar(80),
	"id_number" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guests_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "hotel_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"hotel_name" varchar(120) NOT NULL,
	"location" varchar(160) NOT NULL,
	"contact_phone" varchar(60) NOT NULL,
	"contact_email" varchar(160) NOT NULL,
	"standard_rate" integer NOT NULL,
	"deluxe_rate" integer NOT NULL,
	"suite_rate" integer NOT NULL,
	"vat_bps" integer DEFAULT 1800 NOT NULL,
	"service_charge_bps" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_id" integer NOT NULL,
	"charge_id" integer,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"amount" integer NOT NULL,
	"department" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_no" varchar(40) NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"guest_name" varchar(160) NOT NULL,
	"room_number" integer,
	"room_category" varchar(24),
	"department" varchar(32) NOT NULL,
	"staff_id" varchar(32) NOT NULL,
	"staff_name" varchar(160) DEFAULT 'Staff' NOT NULL,
	"payment_method" varchar(40) NOT NULL,
	"payment_breakdown" text DEFAULT '[]' NOT NULL,
	"total_amount" integer NOT NULL,
	"net_amount" integer DEFAULT 0 NOT NULL,
	"vat_amount" integer DEFAULT 0 NOT NULL,
	"vat_bps" integer DEFAULT 1800 NOT NULL,
	"notes" text,
	"voided" boolean DEFAULT false NOT NULL,
	"booking_id" integer,
	CONSTRAINT "receipts_receipt_no_unique" UNIQUE("receipt_no"),
	CONSTRAINT "receipts_total_positive" CHECK ("receipts"."total_amount" > 0),
	CONSTRAINT "receipts_vat_valid" CHECK ("receipts"."vat_bps" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "room_status_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_number" integer NOT NULL,
	"previous_status" varchar(32) NOT NULL,
	"new_status" varchar(32) NOT NULL,
	"note" text,
	"staff_id" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"number" integer PRIMARY KEY NOT NULL,
	"category" varchar(24) NOT NULL,
	"rate" integer NOT NULL,
	"status" varchar(32) DEFAULT 'Clean' NOT NULL,
	"status_note" text,
	"status_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_number_range" CHECK ("rooms"."number" between 101 and 200),
	CONSTRAINT "rooms_rate_positive" CHECK ("rooms"."rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"email" varchar(160) NOT NULL,
	"staff_code" varchar(32) NOT NULL,
	"role" varchar(40) NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "staff_email_unique" UNIQUE("email"),
	CONSTRAINT "staff_staff_code_unique" UNIQUE("staff_code")
);
--> statement-breakpoint
CREATE TABLE "staff_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"email" varchar(160) NOT NULL,
	"staff_code" varchar(32) NOT NULL,
	"requested_role" varchar(40) NOT NULL,
	"reason" text,
	"password_hash" text NOT NULL,
	"status" varchar(24) DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" varchar(32),
	CONSTRAINT "staff_applications_email_unique" UNIQUE("email"),
	CONSTRAINT "staff_applications_staff_code_unique" UNIQUE("staff_code")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_number_rooms_number_fk" FOREIGN KEY ("room_number") REFERENCES "public"."rooms"("number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_room_number_rooms_number_fk" FOREIGN KEY ("room_number") REFERENCES "public"."rooms"("number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_status_logs" ADD CONSTRAINT "room_status_logs_room_number_rooms_number_fk" FOREIGN KEY ("room_number") REFERENCES "public"."rooms"("number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bookings_room_dates_idx" ON "bookings" USING btree ("room_number","check_in","check_out");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "folio_charges_booking_idx" ON "folio_charges" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "folio_charges_status_idx" ON "folio_charges" USING btree ("status");--> statement-breakpoint
CREATE INDEX "guests_name_idx" ON "guests" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "receipt_items_receipt_idx" ON "receipt_items" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "receipts_issued_idx" ON "receipts" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "room_status_logs_created_idx" ON "room_status_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rooms_status_idx" ON "rooms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "staff_role_idx" ON "staff" USING btree ("role");--> statement-breakpoint
CREATE INDEX "staff_applications_status_idx" ON "staff_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "staff_applications_created_idx" ON "staff_applications" USING btree ("created_at");