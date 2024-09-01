const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = 3005;

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  console.log('Received GET request for /');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/convert', async (req, res) => {
  try {
    const { link } = req.body;
    console.log(`Received POST request to convert link: ${link}`);

    const url = `${link}.json`;
    console.log(`URL requested: ${url}`);
    
    const response = await axios.get(url);
    const data = response.data;
    console.log('Successfully fetched data from Reddit API');
    console.log(data);
    
    let markdown = '';
    const post = data[0].data.children[0].data;
    
    markdown += `# ${post.title}\n\n`;
    markdown += `${post.selftext}\n\n`;
    
    const comments = data[1].data.children;
    for (const comment of comments) {
      if (comment.kind === 't1') {
        markdown += `## ${comment.data.author}\n\n${comment.data.body}\n\n`;
      }
    }
    
    console.log('Successfully converted data to markdown');
    res.json({ markdown });
  } catch (error) {
    console.error('Error during conversion:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});