import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import PaymentModal from '../components/PaymentModal';
import VideoPlayer from '../VideoPlayer';

export default function CourseCatalog({ userEmail }) {
    const [courses, setCourses] = useState([]);
    const [purchased, setPurchased] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [buyingCourse, setBuyingCourse] = useState(null);   // course to show in modal
    const [watchingId, setWatchingId] = useState(null);     // lessonId currently watching

    const fetchData = async () => {
        try {
            const [catalogRes, myRes] = await Promise.all([
                axios.get('/api/courses'),
                axios.get('/api/my-courses'),
            ]);
            setCourses(catalogRes.data);
            setPurchased(new Set(myRes.data));
        } catch (err) {
            toast.error('Failed to load courses.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handlePurchaseSuccess = (lessonId) => {
        setPurchased((prev) => new Set([...prev, lessonId]));
        setBuyingCourse(null);
    };

    if (loading) {
        return <div className="catalog-loading">Loading courses…</div>;
    }

    return (
        <>
            {buyingCourse && (
                <PaymentModal
                    course={buyingCourse}
                    onClose={() => setBuyingCourse(null)}
                    onSuccess={handlePurchaseSuccess}
                />
            )}

            {watchingId && (
                <div className="modal-overlay" onClick={() => setWatchingId(null)}>
                    <div className="player-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="player-modal-header">
                            <span>{courses.find((c) => c.lesson_id === watchingId)?.title ?? 'Course'}</span>
                            <button className="btn btn-ghost" onClick={() => setWatchingId(null)}>✕ Close</button>
                        </div>
                        <VideoPlayer videoUrl={`/uploads/courses/${watchingId}/index.m3u8`} />
                    </div>
                </div>
            )}

            <div>
                <h2 className="page-title">Course Library</h2>
                <p className="page-subtitle">Browse, purchase, and watch courses instantly.</p>

                {courses.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🎬</div>
                        <p>No courses available yet.</p>
                        <span className="text-muted">Check back after the admin uploads a video.</span>
                    </div>
                ) : (
                    <div className="course-grid">
                        {courses.map((course) => {
                            const owned = purchased.has(course.lesson_id);
                            const price = parseFloat(course.price);

                            return (
                                <div className="course-card" key={course.lesson_id}>
                                    <div className="course-thumb">
                                        <span>🎬</span>
                                    </div>

                                    <div className="course-body">
                                        <div className="course-title">{course.title}</div>
                                        {course.description && (
                                            <p className="course-desc">{course.description}</p>
                                        )}

                                        <div className="course-footer">
                                            <div className="course-price">
                                                {price === 0 ? (
                                                    <span className="tag green">Free</span>
                                                ) : (
                                                    <span className="course-price-text">₹{price.toFixed(2)}</span>
                                                )}
                                            </div>

                                            {owned ? (
                                                <div className="course-actions">
                                                    <span className="tag green">✓ Purchased</span>
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}
                                                        onClick={() => setWatchingId(course.lesson_id)}
                                                    >
                                                        Watch
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => setBuyingCourse(course)}
                                                >
                                                    {price === 0 ? 'Enroll free' : 'Buy course'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
