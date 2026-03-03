fetch('http://localhost:8000/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username: 'admin', password: 'admin' })
}).then(res => res.json())
    .then(console.log)
    .catch(console.error);
