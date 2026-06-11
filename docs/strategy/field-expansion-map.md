# Field Expansion Map

> **Companion to** [Vision & Strategy](./vision-and-strategy.md). Internal.
> **Purpose:** how each bioscience subfield works, where its manual bottleneck is, and what we could eventually build for it. **This is the L3 ML-automation roadmap in disguise** — each subfield's bottleneck is a future automation product, and the marketplace is how we learn which one to build first.
> **Last updated:** 2026-06-07

**How to read this:** we launch in **comp-bio / bioinformatics** (§2 of strategy). Every other field below is an *expansion candidate*. We do **not** build any L3 tool for a field until the marketplace has ground through that field's bottleneck enough times that we've personally seen the pattern (strategy §14). Order of expansion follows where (a) our community already overlaps and (b) the bottleneck is most automatable with verified data.

---

## 0. Launch field — Computational biology / bioinformatics

| | |
|---|---|
| **How they work** | Live in code, data, papers. Pipelines over sequencing/omics data (RNA-seq, single-cell, variant calling). R/Python, command line, HPC/cloud. |
| **Daily pain** | Pipeline plumbing, parameter choices, QC of noisy data, reproducing others' analyses, keeping up with literature. |
| **Why first** | Digital-native → immediately fulfillable marketplace supply; expertise is exactly what AI labs buy; API/MCP-native evangelists. |
| **Marketplace task types** | Pipeline design/review, data interpretation, reproducing analyses, statistical review, annotation/curation, agent-output verification. |
| **L3 ML hook** | AutoML over omics; pipeline auto-config; auto-QC of single-cell data; variant-calling assist. |

---

## 1. Microscopy / cell biology

| | |
|---|---|
| **How they work** | Image cells/tissue via light/fluorescence/confocal microscopy; quantify by hand or with semi-manual tools (ImageJ/CellProfiler). |
| **Daily pain** | Counting/segmenting cells, scoring phenotypes, classifying morphology — slow, tedious, subjective, huge image volumes. |
| **Marketplace task types** | Image annotation/labeling, phenotype scoring, segmentation review, ground-truth creation. |
| **L3 ML hook** | **Computer vision (YOLO / SAM / Cellpose-class): cell counting, segmentation, phenotype detection, colony scoring.** A flagship L3 candidate — clear, verifiable, high-volume drudgery. |

---

## 2. Spatial biology / spatial-omics & digital pathology

| | |
|---|---|
| **How they work** | Spatial transcriptomics, multiplexed imaging, whole-slide pathology — map molecules/cells in tissue context. |
| **Daily pain** | Labeling regions, registering layers, annotating tissue structures, cell-type calling in space — enormous manual labeling load. |
| **Marketplace task types** | Region/tissue annotation, spatial labeling, cell-type verification, multi-rater consensus labels. |
| **L3 ML hook** | **Spatial auto-labeling pipelines** (the explicitly named target): vision models that pre-label tissue/regions for expert review. High-value, data-hungry — the marketplace supplies exactly the verified labels needed. |

---

## 3. Structural biology

| | |
|---|---|
| **How they work** | Determine protein/complex structures (cryo-EM, crystallography); increasingly model with AlphaFold-class tools. |
| **Daily pain** | Map interpretation, model building/refinement, validating predicted structures. |
| **Marketplace task types** | Structure validation, model-refinement review, prediction QC. |
| **L3 ML hook** | AlphaFold-adjacent assists; automated model-quality assessment; expert-in-the-loop validation of predictions. (Note: foundation models already strong here — our angle is verification + augmentation, not competing with AlphaFold.) |

---

## 4. Genomics / clinical genetics

| | |
|---|---|
| **How they work** | Sequence and interpret genomes; call and classify variants; link genotype→phenotype. |
| **Daily pain** | Variant interpretation/classification (pathogenic vs benign), curation against databases — labor-intensive and consequential. |
| **Marketplace task types** | Variant curation/classification, literature-evidence linking, second-opinion verification. |
| **L3 ML hook** | Variant-calling/interpretation assist; AutoML over genotype-phenotype data; curation copilots with provenance. |

---

## 5. Neuroscience

| | |
|---|---|
| **How they work** | Record neural/behavioral signals (electrophysiology, EEG, calcium imaging, behavior video). |
| **Daily pain** | Spike sorting, signal cleaning, event/behavior labeling, artifact rejection — heavy manual signal/video annotation. |
| **Marketplace task types** | Signal annotation, spike-sort review, behavior video labeling, artifact verification. |
| **L3 ML hook** | Signal processing + DeepLabCut-style pose/behavior models; automated spike sorting; EEG/calcium-imaging analysis assists. |

---

## 6. Ecology / field biology / biodiversity

| | |
|---|---|
| **How they work** | Field surveys, camera traps, bioacoustic recorders, specimen collection. |
| **Daily pain** | Identifying species from millions of images/audio clips; population counting; tedious at impossible scale. |
| **Marketplace task types** | Species ID/labeling (image & audio), occurrence verification, expert second-opinion on rare taxa. |
| **L3 ML hook** | **Vision + audio recognition: species ID from camera-trap images and bioacoustics.** Naturally crowd-verifiable; strong public-good/brand story. |

---

## 7. Drug discovery / medicinal chemistry

| | |
|---|---|
| **How they work** | Design/screen molecules; model properties (ADMET, binding); interpret assay results. |
| **Daily pain** | Triaging hits, predicting properties, interpreting structure-activity — expert-judgment heavy. |
| **Marketplace task types** | Molecule/hit triage, SAR interpretation, assay-result review, literature evidence synthesis. |
| **L3 ML hook** | Molecular property prediction; SAR copilots; expert-verified training sets for property models. (Industry-adjacent → likely enters via Stream B buyers.) |

---

## 8. Clinical / pathology / radiology (later, regulated)

| | |
|---|---|
| **How they work** | Diagnose from images (histopathology slides, radiology scans) and clinical data. |
| **Daily pain** | High-volume image reading, annotation for ground truth, second opinions. |
| **Marketplace task types** | Diagnostic image annotation, ground-truth labeling, multi-rater consensus. |
| **L3 ML hook** | Diagnostic imaging models with expert-verified labels. **Caution:** heavily regulated (medical device / liability) — a *late*, careful expansion, likely partnered. |

---

## Cross-field pattern (why this is one company, not eight)

Every field above reduces to the same shape: **expensive expert judgment applied to high-volume, semi-structured data (images, signals, sequences, molecules, text), bottlenecked by manual labeling/interpretation, where verified multi-expert consensus is the gold standard.** That is *exactly* the loop we build for comp-bio:

1. Copilot gets the community in.
2. Marketplace commissions expert judgment on buyer-provided inputs → verified, provenance-tagged outputs.
3. Verification network turns consensus into a product and the rarest training signal.
4. Those verified outputs are the training data for the field's L3 model.
5. The L3 model augments the experts, who supervise it and share in its upside.

So expansion isn't eight separate product bets — it's **the same flywheel pointed at the next field's bottleneck, in the order the marketplace tells us is ripe.** Vision/segmentation fields (microscopy §1, spatial §2, ecology §6) are the most natural early L3 targets: clear ground truth, crowd-verifiable, and the exact "genome/cell segmentation + spatial auto-labeling" tools named as the destination.
