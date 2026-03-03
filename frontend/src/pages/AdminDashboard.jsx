import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export default function AdminDashboard() {
    const [courses, setCourses] = useState([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const fetchCourses = async () => {
        try {
            const res = await axios.get('/api/courses');
            setCourses(res.data);
        } catch {
            toast.error('Failed to load courses.');
        }
    };

    useEffect(() => { fetchCourses(); }, []);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!title.trim()) {
            toast.error('Please enter a course title before uploading.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('price', price || '0');

        try {
            setIsUploading(true);
            toast.loading('Uploading and transcoding…', { id: 'upload' });
            await axios.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Course published!', { id: 'upload' });
            setTitle('');
            setDescription('');
            setPrice('');
            await fetchCourses();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed.', { id: 'upload' });
        } finally {
            setIsUploading(false);
            // Reset file input
            e.target.value = '';
        }
    };

    return (
        <div className="section-stack">
            <div>
                <h2 className="page-title">Admin Dashboard</h2>
                <p className="page-subtitle">Upload courses and manage the library.</p>
            </div>

            {/* ── Upload card ── */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Publish a new course</span>
                    <span className="tag blue" style={{ marginLeft: 'auto' }}>Admin only</span>
                </div>
                <div className="card-body">
                    <div className="field">
                        <label htmlFor="course-title">Course title *</label>
                        <input
                            id="course-title"
                            className="input"
                            type="text"
                            placeholder="e.g. React From Scratch"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="course-desc">Description</label>
                        <textarea
                            id="course-desc"
                            className="input textarea"
                            placeholder="Brief description of what students will learn"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="field" style={{ maxWidth: '180px' }}>
                        <label htmlFor="course-price">Price (₹)</label>
                        <input
                            id="course-price"
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0 for free"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                        />
                    </div>

                    <label className={`upload-zone ${isUploading ? 'uploading' : ''}`} style={{ marginTop: '0.5rem' }}>
                        <div className="upload-icon">📂</div>
                        <span className="upload-zone-label">
                            {isUploading ? 'Processing video…' : 'Select MP4 file to upload'}
                        </span>
                        <span className="upload-zone-hint">
                            {isUploading
                                ? 'ffmpeg is transcoding. This may take a minute.'
                                : 'Fill in title above, then click to browse'}
                        </span>
                        <input
                            type="file"
                            accept="video/mp4"
                            onChange={handleUpload}
                            disabled={isUploading}
                        />
                    </label>
                </div>
            </div>

            {/* ── Course list ── */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Published courses</span>
                    <span className="tag" style={{ marginLeft: 'auto' }}>{courses.length} total</span>
                </div>
                {courses.length === 0 ? (
                    <div className="card-body">
                        <p className="text-muted">No courses published yet.</p>
                    </div>
                ) : (
                    <div className="course-table-wrap">
                        <table className="course-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Price</th>
                                    <th>Lesson ID</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {courses.map((c) => (
                                    <tr key={c.lesson_id}>
                                        <td>{c.title}</td>
                                        <td>₹{parseFloat(c.price).toFixed(2)}</td>
                                        <td>
                                            <code className="lesson-id">{c.lesson_id}</code>
                                        </td>
                                        <td className="text-muted">
                                            {new Date(c.created_at).toLocaleDateString('en-IN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
