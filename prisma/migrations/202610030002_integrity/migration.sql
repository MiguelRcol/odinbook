CREATE TABLE "Session" (
  "sid" varchar NOT NULL PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
CREATE INDEX "Session_expire_idx" ON "Session" ("expire");
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_no_self_follow" CHECK ("followerId" <> "followingId");
ALTER TABLE "Post" ADD CONSTRAINT "Post_content_length" CHECK (char_length(btrim("content")) BETWEEN 1 AND 2000);
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_content_length" CHECK (char_length(btrim("content")) BETWEEN 1 AND 500);
