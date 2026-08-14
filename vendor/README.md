# vendor/ — lokal eingebundene Fremdbibliotheken

Diese Dateien lagen früher als CDN-Verweis (cdnjs) im `<head>` von `index.html`. Sie sind jetzt
Teil des Repos, weil das für BlockCalc zwei konkrete Vorteile hat:

- **Sicherheit** — kein fremder Origin, der beliebigen Code im App-Kontext ausführen könnte.
  Ein Subresource-Integrity-Attribut ist damit überflüssig: wer diese Dateien ändern kann,
  kann ebenso `index.html` ändern.
- **Feldeinsatz** — die App ist ab dem allerersten Start offline lauffähig, ohne dass der
  Service Worker zuerst online befüllt werden muss.

## Inhalt

| Datei | Bibliothek | Version | Bytes | SHA-512 (Base64, = SRI-Wert von cdnjs) |
|---|---|---|---|---|
| `three.min.js` | three.js | r128 | 603 445 | `dLxUelApnYxpLt6K2iomGngnHO83iUvZytA3YjDUCjT0HDOHKXnVYdf3hU4JjM8uEhxf9nD1/ey98U3t2vZ0qQ==` |
| `jspdf.umd.min.js` | jsPDF | 2.5.1 | 364 463 | `qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA==` |

Beide Dateien wurden nach dem Download gegen genau diese von cdnjs veröffentlichten Hashes
geprüft und stimmten bitgenau überein.

## Aktualisieren

1. Neue Version von cdnjs laden, z. B.:
   ```
   curl -sSL -o vendor/three.min.js https://cdnjs.cloudflare.com/ajax/libs/three.js/rXXX/three.min.js
   ```
2. Hash gegen den von cdnjs für diese Version angegebenen SRI-Wert prüfen:
   ```
   python3 -c "import hashlib,base64,sys;print('sha512-'+base64.b64encode(hashlib.sha512(open(sys.argv[1],'rb').read()).digest()).decode())" vendor/three.min.js
   ```
3. Tabelle oben nachführen.
4. **Cache-Version in `sw.js` hochzählen** (`blockcalc-vN`), sonst liefert der Service Worker
   bei bestehenden Installationen weiter die alte Datei aus.

Hinweis: three.js r128 ist die Version, gegen die der 3D-Viewer entwickelt und verifiziert ist —
neuere Releases haben brechende API-Änderungen (u. a. Geometry/BufferGeometry, Farb-Management).
Ein Versionssprung ist kein reiner Dateitausch.
