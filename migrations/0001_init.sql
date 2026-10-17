-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "notifyEmail" TEXT NOT NULL,
    "lastValue" TEXT,
    "lastHash" TEXT,
    "lastCheckedAt" DATETIME,
    "lastError" TEXT,
    "imageUrl" TEXT,
    "faviconUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "conditionType" TEXT NOT NULL DEFAULT 'change',
    "conditionValue" TEXT,
    "failStreak" INTEGER NOT NULL DEFAULT 0,
    "cloudBlocked" BOOLEAN NOT NULL DEFAULT false,
    "snoozedUntil" DATETIME,
    "lastCheckedVia" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Change" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "watchId" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Change_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SignInCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Check" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "watchId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "value" TEXT,
    "error" TEXT,
    "durationMs" INTEGER,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Check_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PreviewJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "html" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" DATETIME
);

-- CreateTable
CREATE TABLE "AgentStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastSeenAt" DATETIME NOT NULL,
    "staleNotifiedAt" DATETIME
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "ntfyTopic" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Watch_userId_idx" ON "Watch"("userId");

-- CreateIndex
CREATE INDEX "Watch_isActive_idx" ON "Watch"("isActive");

-- CreateIndex
CREATE INDEX "Change_watchId_idx" ON "Change"("watchId");

-- CreateIndex
CREATE INDEX "SignInCode_email_idx" ON "SignInCode"("email");

-- CreateIndex
CREATE INDEX "SignInCode_expiresAt_idx" ON "SignInCode"("expiresAt");

-- CreateIndex
CREATE INDEX "Check_watchId_checkedAt_idx" ON "Check"("watchId", "checkedAt");

-- CreateIndex
CREATE INDEX "PreviewJob_doneAt_createdAt_idx" ON "PreviewJob"("doneAt", "createdAt");

