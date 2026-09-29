const mangayomiSources = [
  {
    "id": 1776513353,
    "name": "Asura Scans",
    "lang": "en",
    "baseUrl": "https://asurascans.com",
    "apiUrl": "https://api.asurascans.com",
    "iconUrl": "https://www.google.com/s2/favicons?sz=128&domain=https://asurascans.com",
    "typeSource": "single",
    "isManga": true,
    "itemType": 0,
    "version": "1.0.1",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "providers/asurascans/source.js"
  }
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client({ useDartHttpClient: true });
  }

  getHeaders(url) {
    return {
      "Referer": "https://asurascans.com/",
      "Accept": "application/json,text/plain,*/*"
    };
  }

  parseJson(body) {
    return JSON.parse(String(body || "").trim());
  }

  apiGet(path) {
    return this.client.get(this.source.apiUrl + path, this.getHeaders());
  }

  statusCode(status) {
    status = String(status || "").toLowerCase();
    if (status === "ongoing") return 0;
    if (status === "completed") return 1;
    if (status === "hiatus" || status === "seasonal") return 2;
    if (status === "dropped") return 3;
    return 5;
  }

  parseDate(value) {
    if (!value) return null;
    var ts = Date.parse(value);
    if (isNaN(ts)) return null;
    return String(ts);
  }

  normalizePath(value) {
    value = String(value || "");
    if (!value) return "/";
    if (value.indexOf("http://") === 0 || value.indexOf("https://") === 0) return value;
    return value.charAt(0) === "/" ? value : "/" + value;
  }

  slugFromUrl(url) {
    var raw = String(url || "");
    raw = raw.replace(/^https?:\/\/[^/]+/i, "");
    raw = raw.split("?")[0].split("#")[0];
    var parts = raw.split("/").filter(function(x) { return !!x; });
    if (parts.length >= 2 && (parts[0] === "comics" || parts[0] === "series")) {
      return parts[1].replace(/-f[0-9a-f]{6,8}$/i, "");
    }
    if (parts.length === 1) return parts[0].replace(/-f[0-9a-f]{6,8}$/i, "");
    throw new Error("Unable to parse series slug: " + url);
  }

  chapterRefFromUrl(url) {
    var raw = String(url || "");
    var marker = raw.indexOf("||");
    if (marker !== -1) {
      return { seriesSlug: raw.substring(0, marker), chapterSlug: raw.substring(marker + 2) };
    }
    raw = raw.replace(/^https?:\/\/[^/]+/i, "");
    raw = raw.split("?")[0].split("#")[0];
    var parts = raw.split("/").filter(function(x) { return !!x; });
    if (parts.length >= 4 && (parts[0] === "comics" || parts[0] === "series") && parts[2] === "chapter") {
      return {
        seriesSlug: parts[1].replace(/-f[0-9a-f]{6,8}$/i, ""),
        chapterSlug: parts[3]
      };
    }
    throw new Error("Unable to parse chapter URL: " + url);
  }

  parseMangaList(json) {
    var data = json.data || [];
    var meta = json.meta || {};
    var list = data.map(function(item) {
      return {
        name: item.title || item.name || "",
        imageUrl: item.cover || item.cover_url || "",
        link: item.public_url || (item.slug ? "/comics/" + item.slug : "/")
      };
    });
    return { list: list, hasNextPage: meta.has_more === true };
  }

  async getPopular(page) {
    var offset = (parseInt(page) - 1) * 20;
    var res = await this.apiGet("/api/series?sort=rating&order=desc&offset=" + offset + "&limit=20");
    return this.parseMangaList(this.parseJson(res.body));
  }

  async getLatestUpdates(page) {
    var offset = (parseInt(page) - 1) * 20;
    var res = await this.apiGet("/api/series?sort=latest&order=desc&offset=" + offset + "&limit=20");
    return this.parseMangaList(this.parseJson(res.body));
  }

  async search(query, page, filters) {
    var offset = (parseInt(page) - 1) * 20;
    var url = "/api/series?offset=" + offset + "&limit=20&sort=rating&order=desc";
    if (query) url += "&search=" + encodeURIComponent(query);
    var res = await this.apiGet(url);
    return this.parseMangaList(this.parseJson(res.body));
  }

  async getDetail(url) {
    var slug = this.slugFromUrl(url);
    var res = await this.apiGet("/api/series/" + slug);
    var json = this.parseJson(res.body);
    var s = json.series || json;
    var genres = [];
    if (Array.isArray(s.genres)) {
      genres = s.genres.map(function(g) {
        return typeof g === "string" ? g : (g.name || "");
      }).filter(function(g) { return !!g; });
    }
    var publicUrl = this.normalizePath(s.public_url || "/comics/" + slug);
    var chapters = [];
    var offset = 0;
    var limit = 100;
    var seen = {};
    while (true) {
      var cr = await this.apiGet("/api/series/" + slug + "/chapters?offset=" + offset + "&limit=" + limit);
      var cj = this.parseJson(cr.body);
      var rows = cj.data || [];
      if (!rows.length) break;
      var added = 0;
      for (var i = 0; i < rows.length; i++) {
        var ch = rows[i];
        var key = String(ch.id != null ? ch.id : (ch.slug || ""));
        if (!key || seen[key]) continue;
        seen[key] = true;
        added++;
        var label = ch.number != null ? "Chapter " + ch.number : "Chapter";
        var title = String(ch.title || "").trim();
        chapters.push({
          name: title ? label + " - " + title : label,
          url: publicUrl + "/chapter/" + ch.slug,
          dateUpload: this.parseDate(ch.published_at)
        });
      }
      if (rows.length < limit || added === 0) break;
      offset += limit;
    }
    return {
      name: s.title || s.name || "",
      imageUrl: s.cover || s.cover_url || "",
      description: String(s.description || "").replace(/<[^>]+>/g, "").trim(),
      author: s.author || "",
      artist: s.artist || "",
      status: this.statusCode(s.status),
      genre: genres,
      chapters: chapters
    };
  }

  async getPageList(url) {
    var ref = this.chapterRefFromUrl(url);
    var res = await this.apiGet("/api/series/" + ref.seriesSlug + "/chapters/" + ref.chapterSlug);
    var json = this.parseJson(res.body);
    var chapter = json.chapter || json.data || json;
    if (json.data && json.data.chapter) chapter = json.data.chapter;
    var pages = chapter.pages || [];
    if (json.data && json.data.pages) pages = json.data.pages;
    if (json.pages) pages = json.pages;
    var isLocked = chapter.is_locked === true || json.is_locked === true ||
      (json.data && json.data.is_locked === true);
    if (!Array.isArray(pages) || pages.length === 0) {
      if (isLocked) throw new Error("Chapter is locked or requires login/premium.");
      throw new Error("No readable pages found for this chapter.");
    }
    return pages.map(function(p) {
      var value = p;
      if (typeof p !== "string") value = p.url || p.image_url || p.page_url || p.image || p.src || "";
      return { url: value, headers: { "Referer": "https://asurascans.com/" } };
    }).filter(function(p) { return !!p.url; });
  }

  getFilterList() { return []; }
  getSourcePreferences() { return []; }
}
