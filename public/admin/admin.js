// Admin Dashboard JavaScript
// This file handles all the client-side functionality for the admin analytics dashboard

const ADMIN_API_KEY = localStorage.getItem('adminKey') || prompt('Enter admin API key');

// Set the API key for the shared client
apiClient.setApiKey(ADMIN_API_KEY);

let ratingsChart = null;
let feedbackTypesChart = null;
let routeStatsChart = null;

// DOM Elements
const lastUpdatedEl = document.getElementById('lastUpdated');
const errorDiv = document.getElementById('errorDiv');

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    // Refresh every 5 minutes
    setInterval(loadDashboard, 5 * 60 * 1000);
    
    // Add click event listener to refresh button
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadDashboard);
    }
});

async function fetchData(endpoint) {
    try {
        const data = await apiClient.get(endpoint);
        return data;
    } catch (err) {
        console.error(`Error fetching ${endpoint}:`, err);
        showError(`Failed to fetch ${endpoint}: ${err.message}`);
        return null;
    }
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 10000);
}

function formatDate() {
    const now = new Date();
    return now.toLocaleString();
}

function destroyChart(chart) {
    if (chart) {
        chart.destroy();
    }
}

async function loadDashboard() {
    lastUpdatedEl.textContent = `Last updated: ${formatDate()}`;

    // Load main metrics
    const metrics = await fetchData('/metrics');
    if (metrics) {
        document.getElementById('totalQueries').textContent = metrics.totalQueries?.toLocaleString() || '0';
        document.getElementById('avgSimilarity').textContent = `${metrics.averageSimilarity || 0}%`;
        document.getElementById('avgResponseTime').textContent = metrics.averageResponseTime || '0';
        document.getElementById('llmUsageRate').textContent = `${metrics.llmUsageRate || 0}%`;

        // Route stats chart
        if (metrics.routeBreakdown) {
            const ctxRoutes = document.getElementById('routeStatsChart').getContext('2d');
            destroyChart(routeStatsChart);
            routeStatsChart = new Chart(ctxRoutes, {
                type: 'bar',
                data: {
                    labels: Object.keys(metrics.routeBreakdown),
                    datasets: [{
                        label: 'Route Usage',
                        data: Object.values(metrics.routeBreakdown),
                        backgroundColor: [
                            'rgba(102, 126, 234, 0.7)',
                            'rgba(56, 239, 125, 0.7)',
                            'rgba(245, 87, 108, 0.7)',
                            'rgba(79, 172, 254, 0.7)',
                            'rgba(255, 206, 86, 0.7)',
                        ],
                        borderColor: [
                            'rgba(102, 126, 234, 1)',
                            'rgba(56, 239, 125, 1)',
                            'rgba(245, 87, 108, 1)',
                            'rgba(79, 172, 254, 1)',
                            'rgba(255, 206, 86, 1)',
                        ],
                        borderWidth: 1,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false,
                        },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                        },
                    },
                },
            });
        }
    }

    // Top Queries Table
    const topQueries = await fetchData('/metrics/top-queries?limit=10');
    const tbody = document.getElementById('topQueriesTable').querySelector('tbody');
    if (topQueries && topQueries.length > 0) {
        tbody.innerHTML = topQueries.map(q => `
            <tr>
                <td>${escapeHtml(q.query)}</td>
                <td>${q.count}</td>
                <td>${q.avgConfidence}%</td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="3" class="no-data">No query data yet</td></tr>';
    }

    // Feedback Stats
    const feedbackStats = await fetchData('/metrics/feedback-stats');
    if (feedbackStats) {
        // Ratings Chart (Bar)
        const ratingDist = feedbackStats.ratingDistribution || {};
        const ctxRatings = document.getElementById('ratingsChart').getContext('2d');
        destroyChart(ratingsChart);
        ratingsChart = new Chart(ctxRatings, {
            type: 'bar',
            data: {
                labels: ['5 Stars', '4 Stars', '3 Stars', '2 Stars', '1 Star'],
                datasets: [{
                    label: 'Count',
                    data: [
                        ratingDist.fiveStar || 0,
                        ratingDist.fourStar || 0,
                        ratingDist.threeStar || 0,
                        ratingDist.twoStar || 0,
                        ratingDist.oneStar || 0,
                    ],
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                    },
                },
            },
        });

        // Feedback Types Chart (Pie)
        const feedbackTypes = feedbackStats.feedbackTypes || {};
        if (Object.keys(feedbackTypes).length > 0) {
            const ctxTypes = document.getElementById('feedbackTypesChart').getContext('2d');
            destroyChart(feedbackTypesChart);
            feedbackTypesChart = new Chart(ctxTypes, {
                type: 'pie',
                data: {
                    labels: Object.keys(feedbackTypes),
                    datasets: [{
                        data: Object.values(feedbackTypes),
                        backgroundColor: [
                            '#FF6384',
                            '#36A2EB',
                            '#FFCE56',
                            '#4BC0C0',
                            '#9966FF',
                            '#FF9F40',
                        ],
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                },
            });
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

