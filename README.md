# AleBoss72 Mangayomi Extensions

Personal Mangayomi manga-source catalogue.

## Providers

- Weeb Central (EN)
- Asura Scans (EN)
- MangaRead.org (EN)
- MangaWorld (IT)

## Add the repository to Mangayomi

In Mangayomi open **More → Settings → Browse** and add this Manga repository URL:

`https://raw.githubusercontent.com/AleBoss72/mangayomi/refs/heads/main/index.json`

Mangayomi will load the four providers from `index.json`.

## Structure

```text
providers/
├── weebcentral/source.js
├── asurascans/source.js
├── mangaread/source.dart
└── mangaworld/source.js
```

Each source is kept in its own folder so it can be updated independently without changing the catalogue URL.

## Notes

The provider implementations are adapted from open-source Mangayomi community extensions. Website changes can break scraping/API integrations; in that case increment the provider version in both its source metadata (where applicable) and `index.json`.
