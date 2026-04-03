WITH candidate_user AS (
  SELECT id FROM users ORDER BY created_at ASC LIMIT 1
),
ins AS (
  INSERT INTO scheduled_emails (
    user_id,
    to_addr,
    cc_addr,
    bcc_addr,
    subject,
    body_text,
    body_html,
    mailbox_id,
    send_at,
    status
  )
  SELECT
    id,
    'to@example.com',
    'cc@example.com',
    'bcc@example.com',
    '__verify_scheduled_insert__',
    'body',
    '<p>body</p>',
    NULL,
    now(),
    'scheduled'
  FROM candidate_user
  RETURNING id
)
DELETE FROM scheduled_emails
WHERE id IN (SELECT id FROM ins);
