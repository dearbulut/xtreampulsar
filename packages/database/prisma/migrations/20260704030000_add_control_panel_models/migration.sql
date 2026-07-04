-- Control Panel: Customer
CREATE TABLE "customers" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "phone"     TEXT,
  "company"   TEXT,
  "country"   TEXT,
  "notes"     TEXT,
  "status"    TEXT NOT NULL DEFAULT 'ACTIVE',
  "source"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- Control Panel: CustomerLicense
CREATE TABLE "customer_licenses" (
  "id"             TEXT NOT NULL,
  "key"            TEXT NOT NULL,
  "customerId"     TEXT NOT NULL,
  "plan"           TEXT NOT NULL DEFAULT 'STARTER',
  "status"         TEXT NOT NULL DEFAULT 'TRIAL',
  "serverIp"       TEXT,
  "serverDomain"   TEXT,
  "version"        TEXT,
  "maxUsers"       INTEGER NOT NULL DEFAULT 500,
  "maxServers"     INTEGER NOT NULL DEFAULT 2,
  "trialEndsAt"    TIMESTAMP(3),
  "expiresAt"      TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "lastSeenAt"     TIMESTAMP(3),
  "activatedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_licenses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_licenses_key_key" ON "customer_licenses"("key");
ALTER TABLE "customer_licenses" ADD CONSTRAINT "customer_licenses_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Control Panel: CustomerLicenseLog
CREATE TABLE "customer_license_logs" (
  "id"        TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "serverIp"  TEXT NOT NULL,
  "success"   BOOLEAN NOT NULL,
  "message"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_license_logs_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "customer_license_logs" ADD CONSTRAINT "customer_license_logs_licenseId_fkey"
  FOREIGN KEY ("licenseId") REFERENCES "customer_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Control Panel: Ticket
CREATE TABLE "tickets" (
  "id"         TEXT NOT NULL,
  "ticketNo"   TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "subject"    TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'OPEN',
  "priority"   TEXT NOT NULL DEFAULT 'MEDIUM',
  "category"   TEXT NOT NULL DEFAULT 'GENERAL',
  "resolvedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tickets_ticketNo_key" ON "tickets"("ticketNo");
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Control Panel: TicketMessage
CREATE TABLE "ticket_messages" (
  "id"         TEXT NOT NULL,
  "ticketId"   TEXT NOT NULL,
  "content"    TEXT NOT NULL,
  "isStaff"    BOOLEAN NOT NULL DEFAULT false,
  "authorName" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Control Panel: Invoice
CREATE TABLE "invoices" (
  "id"         TEXT NOT NULL,
  "invoiceNo"  TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "amount"     DOUBLE PRECISION NOT NULL,
  "currency"   TEXT NOT NULL DEFAULT 'EUR',
  "status"     TEXT NOT NULL DEFAULT 'PENDING',
  "plan"       TEXT,
  "period"     TEXT,
  "stripeId"   TEXT,
  "paidAt"     TIMESTAMP(3),
  "dueAt"      TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invoices_invoiceNo_key" ON "invoices"("invoiceNo");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Control Panel: ControlAdmin
CREATE TABLE "control_admins" (
  "id"        TEXT NOT NULL,
  "username"  TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "password"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "control_admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "control_admins_username_key" ON "control_admins"("username");
CREATE UNIQUE INDEX "control_admins_email_key" ON "control_admins"("email");
