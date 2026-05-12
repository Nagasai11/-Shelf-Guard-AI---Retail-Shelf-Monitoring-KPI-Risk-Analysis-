"""
KPI Comparison Engine
Compares outputs from YOLOv8 and Depth Anything V2.
Generates comparison metrics, consistency score, and AI conclusions.

THIS IS THE MAIN FEATURE OF THE APPLICATION.
"""

import numpy as np


class KPIComparisonEngine:
    """
    Compares KPI metrics from two independent AI models:
    - Model 1 (YOLOv8): Product detection + surface occupancy
    - Model 2 (Depth Anything V2): Depth analysis + rear occupancy

    The comparison reveals discrepancies like "front looks full, but rear is empty."
    """

    def compare(self, yolo_result, depth_result):
        """
        Main comparison function.
        Takes structured results from both pipelines and produces comparison analysis.
        """
        yolo_metrics = yolo_result.get("kpi_metrics", {})
        depth_metrics = depth_result.get("kpi_metrics", {})

        # ---- Unified KPI Table ----
        kpi_table = self._build_kpi_table(yolo_metrics, depth_metrics)

        # ---- Occupancy Comparison ----
        occupancy_comparison = self._compare_occupancy(yolo_metrics, depth_metrics)

        # ---- Consistency Score ----
        consistency = self._compute_consistency(yolo_metrics, depth_metrics)

        # ---- Model Disagreement ----
        disagreements = self._find_disagreements(yolo_metrics, depth_metrics)

        # ---- Final Shelf Condition ----
        shelf_condition = self._compute_shelf_condition(yolo_metrics, depth_metrics, consistency)

        # ---- AI Conclusion ----
        conclusion = self._generate_conclusion(
            yolo_metrics, depth_metrics, occupancy_comparison,
            consistency, disagreements, shelf_condition
        )

        return {
            "kpi_table": kpi_table,
            "occupancy_comparison": occupancy_comparison,
            "consistency_score": consistency,
            "disagreements": disagreements,
            "shelf_condition": shelf_condition,
            "conclusion": conclusion,
        }

    def _build_kpi_table(self, yolo, depth):
        """Build a side-by-side KPI comparison table."""
        table = []

        # Shelf Density (YOLO)
        table.append({
            "kpi": "Shelf Density",
            "yolo_value": yolo.get("shelf_density", 0),
            "depth_value": None,
            "unit": "products/shelf",
            "source": "yolo",
            "description": "Average products per shelf region",
        })

        # Occupancy Ratio
        yolo_occ = yolo.get("occupancy_ratio", 0)
        depth_occ = depth.get("depth_occupancy_score", 0)
        diff = abs(yolo_occ - depth_occ)
        table.append({
            "kpi": "Occupancy Ratio",
            "yolo_value": round(yolo_occ * 100, 1),
            "depth_value": round(depth_occ * 100, 1),
            "difference": round(diff * 100, 1),
            "unit": "%",
            "source": "both",
            "description": "Surface vs depth-based occupancy estimation",
            "alert": diff > 0.2,
        })

        # Product Count
        table.append({
            "kpi": "Product Count",
            "yolo_value": yolo.get("product_count", 0),
            "depth_value": None,
            "unit": "items",
            "source": "yolo",
            "description": "Detected product count from object detection",
        })

        # Coverage Ratio
        table.append({
            "kpi": "Coverage Ratio",
            "yolo_value": yolo.get("coverage_percentage", 0),
            "depth_value": None,
            "unit": "%",
            "source": "yolo",
            "description": "Product area coverage on shelf surface",
        })

        # Hollow Shelf Score (Depth)
        table.append({
            "kpi": "Hollow Shelf Score",
            "yolo_value": None,
            "depth_value": round(depth.get("hollow_shelf_score", 0) * 100, 1),
            "unit": "%",
            "source": "depth",
            "description": "Detected hollow regions behind product front",
        })

        # Rear Empty Ratio (Depth)
        table.append({
            "kpi": "Rear Empty Ratio",
            "yolo_value": None,
            "depth_value": round(depth.get("rear_empty_ratio", 0) * 100, 1),
            "unit": "%",
            "source": "depth",
            "description": "Empty space detected behind visible products",
        })

        # Spread Score (YOLO)
        table.append({
            "kpi": "Spread Score",
            "yolo_value": round(yolo.get("spread_score", 0) * 100, 1),
            "depth_value": None,
            "unit": "%",
            "source": "yolo",
            "description": "How evenly products are distributed horizontally",
        })

        # Shelf Balance
        table.append({
            "kpi": "Shelf Balance Score",
            "yolo_value": round(yolo.get("shelf_balance_score", 0) * 100, 1),
            "depth_value": round(depth.get("depth_uniformity", 0) * 100, 1),
            "difference": round(abs(yolo.get("shelf_balance_score", 0) - depth.get("depth_uniformity", 0)) * 100, 1),
            "unit": "%",
            "source": "both",
            "description": "Product distribution balance vs depth uniformity",
        })

        # False Fullness Risk (Depth)
        table.append({
            "kpi": "False Fullness Risk",
            "yolo_value": None,
            "depth_value": round(depth.get("false_fullness_risk", 0) * 100, 1),
            "unit": "%",
            "source": "depth",
            "description": "Risk that shelf appears full but has rear empty space",
        })

        return table

    def _compare_occupancy(self, yolo, depth):
        """Direct comparison of occupancy from both models."""
        yolo_occ = yolo.get("occupancy_ratio", 0) * 100
        depth_occ = depth.get("depth_occupancy_score", 0) * 100
        difference = round(yolo_occ - depth_occ, 1)

        if difference > 15:
            interpretation = (
                f"Front shelf appears {yolo_occ:.0f}% full but depth analysis shows "
                f"only {depth_occ:.0f}% real occupancy. "
                f"The {abs(difference):.0f}% gap suggests rear shelf spaces are empty."
            )
            status = "discrepancy_high"
        elif difference > 5:
            interpretation = (
                f"YOLO estimates {yolo_occ:.0f}% occupancy while depth shows {depth_occ:.0f}%. "
                f"A {abs(difference):.0f}% difference indicates some rear depletion."
            )
            status = "discrepancy_moderate"
        elif difference < -5:
            interpretation = (
                f"Depth model sees {depth_occ:.0f}% occupancy vs YOLO's {yolo_occ:.0f}%. "
                f"Some dense rear stock may not be visible from the front."
            )
            status = "hidden_stock"
        else:
            interpretation = (
                f"Both models agree: ~{(yolo_occ + depth_occ) / 2:.0f}% occupancy. "
                f"Shelf condition is consistent between surface and depth views."
            )
            status = "consistent"

        return {
            "yolo_occupancy": round(yolo_occ, 1),
            "depth_occupancy": round(depth_occ, 1),
            "difference": difference,
            "abs_difference": round(abs(difference), 1),
            "interpretation": interpretation,
            "status": status,
        }

    def _compute_consistency(self, yolo, depth):
        """
        Compute how consistent the two models are.
        High consistency = both models agree. Low = significant disagreement.
        """
        comparisons = []

        # Occupancy comparison
        occ_diff = abs(yolo.get("occupancy_ratio", 0) - depth.get("depth_occupancy_score", 0))
        comparisons.append(1.0 - min(1.0, occ_diff * 2))

        # Balance comparison
        bal_diff = abs(yolo.get("shelf_balance_score", 0) - depth.get("depth_uniformity", 0))
        comparisons.append(1.0 - min(1.0, bal_diff * 2))

        # If hollow score is high, consistency drops
        hollow = depth.get("hollow_shelf_score", 0)
        comparisons.append(1.0 - hollow)

        # If false fullness risk is high, consistency drops
        ffr = depth.get("false_fullness_risk", 0)
        comparisons.append(1.0 - ffr)

        score = round(float(np.mean(comparisons)) * 100, 1)
        if score >= 80:
            level = "high"
            label = "Models Strongly Agree"
        elif score >= 60:
            level = "moderate"
            label = "Partial Agreement"
        elif score >= 40:
            level = "low"
            label = "Significant Disagreement"
        else:
            level = "critical"
            label = "Models Contradict Each Other"

        return {
            "score": score,
            "level": level,
            "label": label,
        }

    def _find_disagreements(self, yolo, depth):
        """Identify specific areas where models disagree."""
        disagreements = []

        # Occupancy disagreement
        occ_diff = abs(yolo.get("occupancy_ratio", 0) - depth.get("depth_occupancy_score", 0))
        if occ_diff > 0.15:
            disagreements.append({
                "area": "Shelf Occupancy",
                "yolo_says": f"{yolo.get('occupancy_ratio', 0) * 100:.0f}% filled",
                "depth_says": f"{depth.get('depth_occupancy_score', 0) * 100:.0f}% real occupancy",
                "severity": "high" if occ_diff > 0.25 else "medium",
                "explanation": "Front products mask rear empty spaces",
            })

        # False fullness
        ffr = depth.get("false_fullness_risk", 0)
        if ffr > 0.3:
            disagreements.append({
                "area": "False Fullness",
                "yolo_says": "Shelf looks adequately stocked",
                "depth_says": f"{ffr * 100:.0f}% false fullness risk",
                "severity": "high" if ffr > 0.5 else "medium",
                "explanation": "Products are fronted but rear stock is depleted",
            })

        # Hollow shelf
        hollow = depth.get("hollow_shelf_score", 0)
        if hollow > 0.3:
            disagreements.append({
                "area": "Hollow Shelf Regions",
                "yolo_says": f"Detected {yolo.get('product_count', 0)} products",
                "depth_says": f"{hollow * 100:.0f}% hollow regions detected",
                "severity": "high" if hollow > 0.5 else "medium",
                "explanation": "Some shelf areas have products only at the front edge",
            })

        return disagreements

    def _compute_shelf_condition(self, yolo, depth, consistency):
        """Compute final shelf condition score combining both models."""
        yolo_occ = yolo.get("occupancy_ratio", 0)
        coverage = yolo.get("coverage_percentage", 0) / 100
        balance = yolo.get("shelf_balance_score", 0)
        spread = yolo.get("spread_score", 0)

        depth_occ = depth.get("depth_occupancy_score", 0)
        hollow = depth.get("hollow_shelf_score", 0)
        rear_empty = depth.get("rear_empty_ratio", 0)
        ffr = depth.get("false_fullness_risk", 0)

        # Weighted combination
        condition_score = (
            yolo_occ * 0.15 +          # Surface occupancy
            coverage * 0.10 +           # Coverage
            balance * 0.10 +            # Balance
            spread * 0.05 +             # Spread
            depth_occ * 0.20 +          # Depth occupancy (weighted higher)
            (1 - hollow) * 0.15 +       # No hollow regions
            (1 - rear_empty) * 0.15 +   # No rear empty space
            (1 - ffr) * 0.10            # No false fullness
        )

        score = round(condition_score * 100, 1)
        return {
            "score": score,
            "grade": self._score_to_grade(score),
            "components": {
                "surface_occupancy": round(yolo_occ * 100, 1),
                "depth_occupancy": round(depth_occ * 100, 1),
                "balance": round(balance * 100, 1),
                "hollow_penalty": round(hollow * 100, 1),
                "rear_empty_penalty": round(rear_empty * 100, 1),
                "false_fullness_penalty": round(ffr * 100, 1),
            }
        }

    def _score_to_grade(self, score):
        """Convert numeric score to grade."""
        if score >= 85:
            return "A"
        elif score >= 70:
            return "B"
        elif score >= 55:
            return "C"
        elif score >= 40:
            return "D"
        else:
            return "F"

    def _generate_conclusion(self, yolo, depth, occ_cmp, consistency, disagreements, condition):
        """Generate a natural language AI conclusion about shelf state."""
        lines = []
        score = condition["score"]
        grade = condition["grade"]

        # Opening statement
        if grade in ("A", "B"):
            lines.append(f"Shelf condition is {grade}-rated ({score:.0f}/100). The shelf is well-stocked.")
        elif grade == "C":
            lines.append(f"Shelf condition is {grade}-rated ({score:.0f}/100). Some improvements are needed.")
        else:
            lines.append(f"Shelf condition is {grade}-rated ({score:.0f}/100). Immediate attention required.")

        # Occupancy insight
        lines.append(occ_cmp["interpretation"])

        # Disagreement insights
        if disagreements:
            lines.append(f"⚠ {len(disagreements)} area(s) of model disagreement detected:")
            for d in disagreements:
                lines.append(f"  • {d['area']}: {d['explanation']}")

        # Consistency note
        lines.append(f"Model agreement: {consistency['score']:.0f}% ({consistency['label']})")

        # Recommendation
        if score < 50:
            lines.append("🔴 RECOMMENDATION: Immediate restocking and shelf audit required.")
        elif score < 70:
            lines.append("🟡 RECOMMENDATION: Schedule restocking within the next shift.")
        else:
            lines.append("🟢 RECOMMENDATION: Shelf is in acceptable condition. Continue monitoring.")

        return {
            "text": "\n".join(lines),
            "severity": "critical" if score < 40 else "warning" if score < 65 else "good",
        }
