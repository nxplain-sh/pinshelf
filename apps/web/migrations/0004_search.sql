CREATE VIRTUAL TABLE `bookmarks_fts` USING fts5(
  `bookmark_id` UNINDEXED,
  `title`,
  `description`,
  `notes`,
  `url`,
  `tags`,
  tokenize = 'unicode61 remove_diacritics 2'
);
