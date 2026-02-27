"""
Simulated Sales Data Module
Provides realistic retail sales data for KPI fusion.
"""

import random
import numpy as np
from datetime import datetime, timedelta


class SalesDataProvider:
    """
    Provides simulated historical sales data for fusion with visual signals.
    In production, this would connect to a POS/inventory management system.
    """

    PRODUCT_BASELINES = {
        "Beverage": {"daily_sales": 45, "margin": 0.35, "restock_freq": 2},
        "Snack": {"daily_sales": 60, "margin": 0.42, "restock_freq": 1.5},
        "Canned Good": {"daily_sales": 25, "margin": 0.28, "restock_freq": 4},
        "Cereal Box": {"daily_sales": 18, "margin": 0.38, "restock_freq": 3},
        "Dairy": {"daily_sales": 55, "margin": 0.22, "restock_freq": 1},
        "Sauce/Condiment": {"daily_sales": 15, "margin": 0.45, "restock_freq": 5},
        "Personal Care": {"daily_sales": 12, "margin": 0.52, "restock_freq": 7},
        "Household": {"daily_sales": 20, "margin": 0.30, "restock_freq": 4},
    }

    def get_sales_data(self, category_distribution):
        """
        Generate sales metrics based on detected product categories.
        Fuses visual signals with simulated sales performance data.
        """
        sales_data = {}
        total_revenue = 0
        total_units = 0

        for category, count in category_distribution.items():
            baseline = self.PRODUCT_BASELINES.get(category, {
                "daily_sales": 20, "margin": 0.30, "restock_freq": 3
            })

            # Simulate variance
            daily_sales = int(baseline["daily_sales"] * random.uniform(0.6, 1.4))
            avg_price = round(random.uniform(2.5, 15.0), 2)
            weekly_revenue = round(daily_sales * 7 * avg_price, 2)

            sales_data[category] = {
                "shelf_count": count,
                "daily_sales_avg": daily_sales,
                "weekly_revenue": weekly_revenue,
                "profit_margin": round(baseline["margin"] * random.uniform(0.85, 1.15), 3),
                "restock_frequency_days": round(baseline["restock_freq"] * random.uniform(0.8, 1.2), 1),
                "stockout_risk": round(random.uniform(0.05, 0.45), 3),
                "sell_through_rate": round(random.uniform(0.4, 0.95), 3),
                "days_of_supply": round(random.uniform(1, 14), 1),
            }

            total_revenue += weekly_revenue
            total_units += daily_sales * 7

        return {
            "category_metrics": sales_data,
            "store_summary": {
                "total_weekly_revenue": round(total_revenue, 2),
                "total_weekly_units": total_units,
                "avg_basket_size": round(random.uniform(12, 35), 2),
                "foot_traffic_index": round(random.uniform(0.5, 1.0), 3),
                "conversion_rate": round(random.uniform(0.15, 0.45), 3),
            },
            "trends": self._generate_trends(category_distribution),
        }

    def _generate_trends(self, category_distribution):
        """Generate 7-day trend data for visualization."""
        trends = {}
        dates = [(datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]

        for category in category_distribution:
            baseline = self.PRODUCT_BASELINES.get(category, {"daily_sales": 20})
            daily = baseline["daily_sales"]

            trend_data = []
            for i, date in enumerate(dates):
                # Add realistic variance with slight trend
                factor = 1.0 + (i - 3) * 0.02  # Slight upward trend
                sales = int(daily * factor * random.uniform(0.7, 1.3))
                trend_data.append({"date": date, "sales": max(0, sales)})

            trends[category] = trend_data

        return trends

    def get_historical_kpis(self):
        """Get historical KPI data for trend analysis."""
        dates = [(datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(29, -1, -1)]

        return {
            "occupancy_history": [
                {"date": d, "value": round(random.uniform(0.55, 0.95), 3)}
                for d in dates
            ],
            "stockout_history": [
                {"date": d, "value": random.randint(0, 8)}
                for d in dates
            ],
            "revenue_history": [
                {"date": d, "value": round(random.uniform(5000, 15000), 2)}
                for d in dates
            ],
        }
