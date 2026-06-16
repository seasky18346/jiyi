import { useState, useEffect, useCallback } from 'react';

export default function useReviews(dailyNewGoal, dailyReviewGoal, enabled = true) {
  const [loading, setLoading] = useState(enabled);
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState({
    newQuestions: [],
    dueQuestions: [],
    errorReinforcement: [],
    delayedQuestions: [],
    allReviews: []
  });

  const fetchReviews = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [resReviews, resStats] = await Promise.all([
        fetch('/api/today-reviews').then(r => r.json()),
        fetch('/api/statistics').then(r => r.json())
      ]);
      if (resReviews.success) {
        setReviews(resReviews.data);
      }
      if (resStats.success) {
        setStats(resStats.data);
      }
    } catch (err) {
      console.error('Failed to fetch reviews and statistics:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      fetchReviews();
    } else {
      setLoading(false);
    }
  }, [fetchReviews, enabled]);

  // Derived properties and capping
  const newQuestionsCount = reviews.newQuestions?.length || 0;
  const totalUnlearned = stats ? (stats.totalQuestions - stats.learnedQuestions) : newQuestionsCount;
  const forgotCount = reviews.errorReinforcement?.length || 0;

  // Capped Learn queue
  const todayNewTargetCount = Math.min(dailyNewGoal, newQuestionsCount);
  const cappedLearnQueue = reviews.newQuestions?.slice(0, todayNewTargetCount) || [];

  // Unified Review Queue: errorReinforcement + delayedQuestions + dueQuestions + upcomingQuestions
  const combinedReviewList = [
    ...(reviews.errorReinforcement || []),
    ...(reviews.delayedQuestions || []),
    ...(reviews.dueQuestions || []),
    ...(reviews.upcomingQuestions || [])
  ];

  // Cap by daily review limit safely (unlimited check)
  const cappedReviewQueue = dailyReviewGoal === 'unlimited'
    ? combinedReviewList
    : combinedReviewList.slice(0, dailyReviewGoal);

  const dueReviewCount = cappedReviewQueue.length;
  const actualDueCount = (reviews.errorReinforcement?.length || 0) + (reviews.delayedQuestions?.length || 0) + (reviews.dueQuestions?.length || 0);
  const delayedCount = reviews.delayedQuestions?.length || 0;
  const dueQuestionsCount = reviews.dueQuestions?.length || 0;

  return {
    loading,
    stats,
    reviews,
    fetchReviews,
    totalUnlearned,
    forgotCount,
    dueReviewCount,
    actualDueCount,
    delayedCount,
    dueQuestionsCount,
    newQuestionsCount,
    cappedLearnQueue,
    cappedReviewQueue
  };
}
