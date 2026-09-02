-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "HifdhCategory" AS ENUM ('SABAQ', 'SABQI', 'MANZIL');

-- CreateEnum
CREATE TYPE "AssignmentScope" AS ENUM ('AYAH_RANGE', 'PAGE_RANGE', 'SURAH', 'JUZ', 'HIZB', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "LessonRating" AS ENUM ('EXCELLENT', 'GOOD', 'NEEDS_WORK', 'REPEAT_TOMORROW');

-- CreateEnum
CREATE TYPE "MistakeType" AS ENUM ('FORGOTTEN_WORD', 'WRONG_WORD', 'SKIPPED_WORD', 'ADDED_WORD', 'WORD_ORDER', 'HESITATION', 'BEGINNING_ERROR', 'ENDING_ERROR', 'MUTASHABIHAT', 'TAJWID', 'PRONUNCIATION');

-- CreateEnum
CREATE TYPE "MistakeSource" AS ENUM ('TEACHER', 'TYPING', 'RECITATION', 'QUIZ');

-- CreateEnum
CREATE TYPE "ExerciseMode" AS ENUM ('LISTEN_FOLLOW', 'FIVE_BY_FIVE', 'TYPE_FROM_MEMORY', 'VANISHING_WORDS', 'NEXT_WORD', 'COMPLETE_AYAH', 'NEXT_AYAH', 'MUTASHABIHAT', 'RECITATION');

-- CreateEnum
CREATE TYPE "MemorizationState" AS ENUM ('NOT_STARTED', 'LEARNING', 'MEMORIZED', 'STRONG', 'NEEDS_REVISION', 'WEAK');

-- CreateEnum
CREATE TYPE "WeaknessLevel" AS ENUM ('WORD', 'AYAH', 'PAGE', 'SURAH', 'JUZ');

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "schoolId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_teachers" (
    "classId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "class_teachers_pkey" PRIMARY KEY ("classId","teacherId")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT,
    "sabqiWindowPages" INTEGER NOT NULL DEFAULT 5,
    "repetitionTarget" INTEGER NOT NULL DEFAULT 5,
    "strictTashkeel" BOOLEAN NOT NULL DEFAULT false,
    "gamificationOn" BOOLEAN NOT NULL DEFAULT true,
    "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_links" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'parent',

    CONSTRAINT "parent_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT,
    "category" "HifdhCategory" NOT NULL,
    "scope" "AssignmentScope" NOT NULL,
    "fromVerseKey" TEXT NOT NULL,
    "toVerseKey" TEXT NOT NULL,
    "ayahCount" INTEGER NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "surahNumber" INTEGER,
    "juzNumber" INTEGER,
    "hizbNumber" INTEGER,
    "label" TEXT,
    "assignedFor" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_lessons" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_entries" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "category" "HifdhCategory" NOT NULL,
    "status" "CompletionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "rating" "LessonRating",
    "mistakeCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lesson_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mistakes" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "verseKey" TEXT NOT NULL,
    "wordPosition" INTEGER,
    "mistakeType" "MistakeType" NOT NULL,
    "source" "MistakeSource" NOT NULL,
    "category" "HifdhCategory",
    "teacherId" TEXT,
    "lessonId" TEXT,
    "practiceSessionId" TEXT,
    "page" INTEGER NOT NULL,
    "juz" INTEGER NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mistakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "sabaqSeconds" INTEGER NOT NULL DEFAULT 0,
    "sabqiSeconds" INTEGER NOT NULL DEFAULT 0,
    "manzilSeconds" INTEGER NOT NULL DEFAULT 0,
    "ayatPracticed" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "exercisesCompleted" INTEGER NOT NULL DEFAULT 0,
    "sabaqAccuracy" INTEGER,
    "sabqiAccuracy" INTEGER,
    "manzilAccuracy" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_attempts" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "category" "HifdhCategory",
    "mode" "ExerciseMode" NOT NULL,
    "verseKey" TEXT NOT NULL,
    "fromWordPosition" INTEGER,
    "toWordPosition" INTEGER,
    "correct" BOOLEAN NOT NULL,
    "accuracy" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ayah_progress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "verseKey" TEXT NOT NULL,
    "state" "MemorizationState" NOT NULL DEFAULT 'NOT_STARTED',
    "page" INTEGER NOT NULL,
    "juz" INTEGER NOT NULL,
    "firstMemorizedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "consecutiveSuccess" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccuracy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ayah_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weakness_scores" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "level" "WeaknessLevel" NOT NULL,
    "refKey" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mistakeCount" INTEGER NOT NULL DEFAULT 0,
    "lastMistakeAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weakness_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schools_slug_key" ON "schools"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_schoolId_role_idx" ON "users"("schoolId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "programs_schoolId_name_key" ON "programs"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "classes_schoolId_name_key" ON "classes"("schoolId", "name");

-- CreateIndex
CREATE INDEX "class_teachers_teacherId_idx" ON "class_teachers"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_userId_key" ON "student_profiles"("userId");

-- CreateIndex
CREATE INDEX "enrollments_studentId_idx" ON "enrollments"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_classId_studentId_key" ON "enrollments"("classId", "studentId");

-- CreateIndex
CREATE INDEX "parent_links_studentId_idx" ON "parent_links"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "parent_links_parentId_studentId_key" ON "parent_links"("parentId", "studentId");

-- CreateIndex
CREATE INDEX "assignments_studentId_assignedFor_idx" ON "assignments"("studentId", "assignedFor");

-- CreateIndex
CREATE INDEX "assignments_studentId_category_active_idx" ON "assignments"("studentId", "category", "active");

-- CreateIndex
CREATE INDEX "teacher_lessons_studentId_date_idx" ON "teacher_lessons"("studentId", "date");

-- CreateIndex
CREATE INDEX "teacher_lessons_teacherId_date_idx" ON "teacher_lessons"("teacherId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_entries_lessonId_category_key" ON "lesson_entries"("lessonId", "category");

-- CreateIndex
CREATE INDEX "mistakes_studentId_verseKey_idx" ON "mistakes"("studentId", "verseKey");

-- CreateIndex
CREATE INDEX "mistakes_studentId_resolved_createdAt_idx" ON "mistakes"("studentId", "resolved", "createdAt");

-- CreateIndex
CREATE INDEX "mistakes_studentId_createdAt_idx" ON "mistakes"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "mistakes_studentId_page_idx" ON "mistakes"("studentId", "page");

-- CreateIndex
CREATE INDEX "practice_sessions_studentId_startedAt_idx" ON "practice_sessions"("studentId", "startedAt");

-- CreateIndex
CREATE INDEX "practice_attempts_studentId_verseKey_idx" ON "practice_attempts"("studentId", "verseKey");

-- CreateIndex
CREATE INDEX "practice_attempts_sessionId_idx" ON "practice_attempts"("sessionId");

-- CreateIndex
CREATE INDEX "ayah_progress_studentId_nextReviewAt_idx" ON "ayah_progress"("studentId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "ayah_progress_studentId_state_idx" ON "ayah_progress"("studentId", "state");

-- CreateIndex
CREATE INDEX "ayah_progress_studentId_juz_idx" ON "ayah_progress"("studentId", "juz");

-- CreateIndex
CREATE UNIQUE INDEX "ayah_progress_studentId_verseKey_key" ON "ayah_progress"("studentId", "verseKey");

-- CreateIndex
CREATE INDEX "weakness_scores_studentId_level_score_idx" ON "weakness_scores"("studentId", "level", "score");

-- CreateIndex
CREATE UNIQUE INDEX "weakness_scores_studentId_level_refKey_key" ON "weakness_scores"("studentId", "level", "refKey");

-- CreateIndex
CREATE INDEX "point_transactions_studentId_createdAt_idx" ON "point_transactions"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_studentId_code_key" ON "achievements"("studentId", "code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_links" ADD CONSTRAINT "parent_links_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_links" ADD CONSTRAINT "parent_links_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_lessons" ADD CONSTRAINT "teacher_lessons_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_lessons" ADD CONSTRAINT "teacher_lessons_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_entries" ADD CONSTRAINT "lesson_entries_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "teacher_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_entries" ADD CONSTRAINT "lesson_entries_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "teacher_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "practice_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ayah_progress" ADD CONSTRAINT "ayah_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weakness_scores" ADD CONSTRAINT "weakness_scores_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
