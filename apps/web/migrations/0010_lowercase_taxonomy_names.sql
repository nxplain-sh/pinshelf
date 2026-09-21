-- Names are now stored lowercased; name_key already holds the lowercase form,
-- so this only fixes rows saved before the rule existed.
UPDATE tags SET name = name_key WHERE name <> name_key;
UPDATE collections SET name = name_key WHERE name <> name_key;
