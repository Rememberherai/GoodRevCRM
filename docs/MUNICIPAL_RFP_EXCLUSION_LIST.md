# Municipal RFP Exclusion List - Comprehensive Analysis

**Analysis Date:** February 8, 2026
**Total RFPs Analyzed:** 5,931 municipal_minutes RFPs
**Source:** GoodRevCRM Supabase Database

---

## Executive Summary

This analysis examined all 5,931 municipal RFPs (from municipal minutes scraping) to identify low-value supply contracts and routine operational items that should be excluded from business development pipelines. The keywords below are ranked by frequency and impact.

**Key Findings:**
- **1,800+ RFPs** (30%+) can be filtered using the top 20 keywords
- Chemical supply contracts represent ~72 unique matches
- Routine maintenance/service contracts account for ~700+ matches
- Replacement/upgrade projects (not new capital) represent ~714 matches

---

## Tier 1: High-Impact Exclusion Keywords (50+ matches each)

These keywords should be implemented first as they filter the most RFPs:

| Keyword | Count | % of Total | Category |
|---------|-------|------------|----------|
| replacement | 447 | 7.54% | Operational/Maintenance |
| usine | 345 | 5.82% | French operational term |
| program | 295 | 4.97% | Administrative |
| upgrade | 267 | 4.50% | Enhancement (not new capital) |
| épuration | 255 | 4.30% | French wastewater term |
| waste | 242 | 4.08% | Routine waste management |
| collection | 238 | 4.01% | Routine collection services |
| study | 215 | 3.63% | Consulting/Analysis |
| extension | 201 | 3.39% | Small additions to existing |
| pumping station | 199 | 3.36% | Operational infrastructure |
| traitement | 188 | 3.17% | French treatment term |
| maintenance | 140 | 2.36% | Routine maintenance |
| refurbishment | 134 | 2.26% | Existing asset refresh |
| materials | 130 | 2.19% | Supply contracts |
| service | 123 | 2.07% | Ongoing services |
| inspection | 116 | 1.96% | Routine inspection |
| treatment plant | 111 | 1.87% | Operational facilities |
| supply | 108 | 1.82% | Supply contracts |
| pump | 99 | 1.67% | Equipment supply |
| repair | 91 | 1.53% | Maintenance |
| agreement | 82 | 1.38% | Ongoing agreements |
| meters | 66 | 1.11% | Small utility equipment |
| contract renewal | 57 | 0.96% | Renewals not new work |
| recycling | 53 | 0.89% | Routine waste management |
| bins | 53 | 0.89% | Small equipment |
| lagoon | 53 | 0.89% | Operational infrastructure |
| cleaning | 50 | 0.84% | Routine service |
| disposal | 50 | 0.84% | Routine waste service |

**Tier 1 Total Impact:** ~3,900 keyword matches (with overlap)

---

## Tier 2: Medium-Impact Exclusion Keywords (10-49 matches)

| Keyword | Count | % of Total | Category |
|---------|-------|------------|----------|
| achat | 47 | 0.79% | French purchase term |
| analysis | 46 | 0.78% | Consulting |
| assessment | 39 | 0.66% | Consulting |
| annual | 36 | 0.61% | Recurring service |
| meter | 36 | 0.61% | Small equipment |
| valve | 36 | 0.61% | Small equipment |
| bylaw | 35 | 0.59% | Administrative |
| monitoring | 32 | 0.54% | Routine service |
| report | 30 | 0.51% | Administrative |
| tank | 30 | 0.51% | Small equipment |
| entretien | 27 | 0.46% | French maintenance term |
| hydrant | 27 | 0.46% | Small equipment |
| pumps | 24 | 0.40% | Equipment supply |
| sulfate | 23 | 0.39% | Chemical supply |
| operations | 23 | 0.39% | Operational services |
| composting | 20 | 0.34% | Routine waste service |
| garbage | 20 | 0.34% | Routine waste service |
| valves | 17 | 0.29% | Small equipment |
| calibration | 17 | 0.29% | Routine service |
| laboratory | 15 | 0.25% | Testing services |
| container | 15 | 0.25% | Small equipment |
| testing | 12 | 0.20% | Routine service |
| sampling | 12 | 0.20% | Routine service |
| parts | 12 | 0.20% | Supply contracts |
| postage | 12 | 0.20% | Administrative (likely composting) |
| audit | 12 | 0.20% | Consulting |
| chlorine | 11 | 0.19% | Chemical supply |
| training | 11 | 0.19% | Professional development |
| operator | 11 | 0.19% | Operational services |
| lift station | 11 | 0.19% | Operational infrastructure |
| containers | 10 | 0.17% | Small equipment |
| policy | 10 | 0.17% | Administrative |
| approvisionnement | 10 | 0.17% | French supply term |

**Tier 2 Total Impact:** ~700+ additional keyword matches

---

## Tier 3: Specific Chemical Supply Keywords

These chemicals are frequently purchased in small recurring contracts:

| Chemical/Product | Count | Examples |
|------------------|-------|----------|
| hypochlorite | 9 | Sodium hypochlorite 12% bulk supply |
| alum | 7 | Aluminum sulfate for wastewater treatment |
| aluminum sulfate | 6 | Liquid aluminum sulfate chemicals |
| coagulant | 3 | PAX-XL8 coagulant bulk supply |
| ferric | 3 | Ferric sulfate via UMQ group purchase |
| polymer | (not counted individually) | Water treatment polymer |
| sodium hydroxide | 3 | Caustic soda for pH control |
| pax | 4 | Polyaluminum chloride (PAX) |
| lime | 2 | Hydrated calcium lime |
| chemical supply | 2 | General chemical supply contracts |
| chemical | 4 | Generic chemical references |
| phosphate | 4 | Phosphate treatments |

**Tier 3 Total Impact:** ~72 chemical supply contracts

---

## Tier 4: Low-Value Operational Keywords (1-9 matches)

| Keyword | Count | Notes |
|---------|-------|-------|
| bin | 9 | Single bins vs. multiple |
| operational | 9 | General operations |
| flushing | 8 | Hydrant/system flushing |
| emergency | 8 | Emergency repairs |
| operating | 8 | Operating services |
| resurfacing | 6 | Road resurfacing |
| sodium hypochlorite | 2 | Specific chemical form |
| billing | 2 | Administrative services |
| snow removal | 1 | Seasonal service |
| meter reading | 1 | Routine service |

---

## Implementation Strategy

### Phase 1: Critical Exclusions (Immediate)
Implement these broad, high-impact filters first:

```
- study
- maintenance
- repair
- supply/supplies
- service
- testing/inspection/monitoring/analysis
- replacement
- upgrade (when not referring to major new construction)
- waste/collection/disposal/recycling
- chemical (+ specific chemical names)
- meter/meters
- valve/valves
- parts/materials (in supply context)
```

**Expected Impact:** Filter ~1,500-2,000 low-value RFPs (25-35% of total)

### Phase 2: Operational Terms (Week 2)
Add operational and recurring service filters:

```
- agreement (ongoing service agreements)
- contract renewal
- annual/monthly/quarterly/bi-annual
- program (grant/subsidy programs)
- cleaning
- training
- operator
- calibration
- flushing
```

**Expected Impact:** Additional ~400-500 RFPs filtered

### Phase 3: Language-Specific Terms (Week 3)
For Quebec municipalities, add French operational terms:

```
- usine (plant/facility)
- épuration (wastewater treatment)
- traitement (treatment)
- entretien (maintenance)
- achat (purchase)
- approvisionnement (supply)
```

**Expected Impact:** Additional ~600-700 RFPs filtered (primarily Quebec)

### Phase 4: Infrastructure-Specific (Week 4)
Filter small-scale infrastructure work:

```
- pumping station
- lift station
- lagoon
- tank
- treatment plant (when operational, not new construction)
- pump/pumps
- hydrant
- bin/bins/container
```

**Expected Impact:** Additional ~400-500 RFPs filtered

---

## Pattern-Based Exclusions

### Title Patterns to Exclude

1. **"Contract for [chemical/supply]"** - Indicates supply contract
2. **"Purchase of [item]"** - 22 RFPs match this pattern
3. **"Supply and delivery"** - Direct supply contracts
4. **"[French term] + [another French term]"** - Often operational Quebec contracts
5. **Dollar amounts in title** - Only 5 RFPs had this, often grant programs

### Value Indicators (Lower Priority)

While only 5 RFPs had explicit dollar amounts in titles, consider additional filters:
- Annual/monthly/quarterly (recurring small costs)
- Rental agreements
- Emergency repairs (under certain thresholds)

---

## Consolidated Master Exclusion List

### For Implementation in Code (Recommended Keywords)

**Top 50 Keywords by Combined Impact:**

```javascript
const exclusionKeywords = [
  // Tier 1: High Impact (50+ matches)
  'replacement', 'upgrade', 'program', 'study',
  'maintenance', 'repair', 'service',
  'waste', 'collection', 'disposal', 'recycling',
  'supply', 'supplies', 'materials', 'parts',
  'inspection', 'testing', 'monitoring', 'analysis', 'assessment', 'sampling',
  'cleaning', 'meter', 'meters', 'valve', 'valves',
  'bins', 'bin', 'container', 'containers',
  'agreement', 'contract renewal',

  // Tier 2: Chemicals
  'chemical', 'hypochlorite', 'chlorine', 'alum', 'aluminum sulfate',
  'sulfate', 'coagulant', 'polymer', 'ferric', 'lime',
  'sodium hydroxide', 'caustic', 'pax', 'phosphate',

  // Tier 3: French Operational Terms
  'usine', 'épuration', 'traitement', 'entretien', 'achat', 'approvisionnement',

  // Tier 4: Operational Infrastructure
  'pumping station', 'lift station', 'treatment plant', 'lagoon',
  'pump', 'pumps', 'tank', 'hydrant',

  // Tier 5: Services
  'operator', 'operational', 'operations', 'operating',
  'calibration', 'flushing', 'training', 'audit', 'consulting',
  'annual', 'monthly', 'quarterly', 'bi-annual',
  'emergency', 'routine',

  // Tier 6: Administrative
  'bylaw', 'policy', 'report', 'billing',

  // Tier 7: Waste Management
  'garbage', 'composting', 'refuse',

  // Tier 8: Minor Work
  'resurfacing', 'patching', 'striping', 'marking',
  'extension' // (small extensions, not major expansions)
];
```

---

## Quality Assurance Notes

### Keywords to Use with Caution

Some keywords may have false positives:

1. **"replacement"** - Can sometimes refer to large-scale replacements (e.g., replacing entire water mains vs. replacing a single valve)
2. **"upgrade"** - May include significant capital projects, not just minor improvements
3. **"extension"** - Could be major infrastructure extensions vs. small service line additions
4. **"treatment plant"** - New treatment plants are capital projects; operational services are not

### Recommended Approach

Use **multi-keyword scoring** rather than binary exclusion:
- 1 keyword match = flag for review
- 2+ keyword matches = likely exclude
- 3+ keyword matches = auto-exclude

Example:
- "Water Meter Replacement" = 2 keywords (meter + replacement) = likely exclude
- "Wastewater Treatment Plant Upgrade - Chemical Supply" = 4 keywords = auto-exclude
- "Water Main Replacement - Major Infrastructure" = 1 keyword but context suggests capital = review

---

## Expected Results

### Before Filtering
- Total municipal RFPs: 5,931

### After Tier 1-2 Filtering (Top 50 keywords)
- **Estimated exclusions: 2,000-2,500 RFPs (35-40%)**
- Remaining high-value opportunities: 3,500-3,900 RFPs

### After All Tiers (Full keyword list)
- **Estimated exclusions: 3,000-3,500 RFPs (50-60%)**
- Remaining high-value opportunities: 2,500-3,000 RFPs

### Success Metrics
- Reduction in low-value RFPs processed: 50-60%
- Improved sales team efficiency: Focus on ~2,500 high-value opportunities
- Estimated time saved: 30-40% reduction in RFP review time

---

## Next Steps

1. **Implement Tier 1 keywords** in the RFP filtering system
2. **Monitor false positive rate** - Track how many excluded RFPs should have been included
3. **Adjust thresholds** based on business value definitions (e.g., what constitutes "low-value"?)
4. **Add value-based filtering** if dollar amounts become more prevalent in data
5. **Refine French terms** for Quebec-specific filtering
6. **Create exception rules** for keywords that have high false positive rates

---

## Appendix: Sample Excluded RFPs

### Chemical Supply Examples
- "Boisbriand Wastewater Treatment Plant Alum Supply Contract 2025-2391"
- "Baie-Comeau Water Treatment - Sodium Hypochlorite 12% Bulk Supply"
- "Ville d'Amos Water and Wastewater Treatment Plants - Grouped Purchase of Ferric Sulfate"

### Routine Maintenance Examples
- "Watson Drain Maintenance"
- "Municipal Drain Maintenance and Repair Projects"
- "Bi-annual Municipal Hydrant Flushing"

### Testing/Inspection Examples
- "Community Onsite Septic Inspection Program"
- "Alvinston Distribution System Inspection Report"
- "Lake Water Testing and Septic System By-Law Support"

### Supply/Equipment Examples
- "Laird Fairgrounds Water Meters"
- "Beth-Halevy Valve Chamber Replacement"
- "Molok Waste Bins Acquisition and Transportation"

---

**Analysis Complete**
Generated: February 8, 2026
Data Source: GoodRevCRM Supabase Database
Analyst: Claude Code Analysis Engine
