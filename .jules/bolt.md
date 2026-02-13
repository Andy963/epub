## 2026-02-13 - [Optimized EpubCFI.compare]
**Learning:** Parsing full CFI strings to compare their spine position (chapter) is a major bottleneck when sorting many locations. Extracting the spine index with a regex avoids full parsing for the majority of comparisons (inter-chapter).
**Action:** Always look for "fast paths" in comparison functions where a high-level property can determine the order without deep inspection. Fallback to full logic for equal high-level properties.
