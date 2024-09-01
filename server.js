const express = require('express');
const axios = require('axios');
const fs = require('fs');
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
    const responseJson = JSON.stringify(data,null,4);

    // save responseJson to a file
    const linkFileName = link.replace(/[^a-zA-Z0-9]/g, '_');
    fs.writeFileSync(`response-${linkFileName}.json`, responseJson);


    console.log("Creating obsidian canvas");

    const obsidianCanvas = redditToObsidianCanvas(data);
    const obsidianCanvasJson = JSON.stringify(obsidianCanvas,null,4);
    fs.writeFileSync(`canvas-${linkFileName}.canvas`, obsidianCanvasJson);
    
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


function redditToObsidianCanvas(redditJson) {
  let nodes = [];
  let edges = [];
  let yOffset = 0;  // Global offset to manage Y positions

  function createNode(id, text, x, y) {
      return {
          id: id,
          type: "text",
          x: x,
          y: y,
          width: 300,
          height: 100,
          text: text,
          color: "#FFD700"
      };
  }

  function processComment(comment, parentId = null, x = 0, y = 0, depth = 0) {
      const commentId = uuidv4();
      const nodeText = `${comment.author}: ${comment.body}`;
      nodes.push(createNode(commentId, nodeText, x, y));

      // Create an edge between the parent and this comment
      if (parentId !== null) {
          edges.push({
              id: uuidv4(),
              fromNode: parentId,
              toNode: commentId,
              fromSide: "right",
              toSide: "left"
          });
      }

      // Update yOffset for the next comment or reply
      let childY = y + 150;

      // Process replies if any
      if (comment.replies && comment.replies.data && comment.replies.data.children) {
          comment.replies.data.children.forEach(reply => {
              if (reply.kind === 't1') {  // It's a comment
                  processComment(reply.data, commentId, x + 400, childY, depth + 1);
                  childY += 150;  // Increase Y for the next sibling
              }
          });
      }

      // Update global yOffset for the next top-level comment
      yOffset = Math.max(yOffset, childY);
  }

  // Process the main post
  redditJson[0].data.children.forEach(child => {
      const post = child.data;
      const postId = uuidv4();
      const postText = `${post.author}: ${post.title}\n${post.selftext}`;
      nodes.push(createNode(postId, postText, 0, yOffset));  // Use yOffset to place the post

      // Process comments
      let commentY = yOffset + 150;
      redditJson[1].data.children.forEach(comment => {
          if (comment.kind === 't1') {  // It's a comment
              processComment(comment.data, postId, 400, commentY);
              commentY += 150;  // Increment Y for the next top-level comment
          }
      });

      // Update yOffset for the next post (if any)
      yOffset = commentY;
  });

  // Prepare the final canvas data
  return {
      nodes: nodes,
      edges: edges
  };
}

// Helper function to generate unique IDs
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
  });
}

// Example usage
// const redditJson = JSON.parse(fs.readFileSync('input_reddit.json', 'utf8'));
// const canvasJson = redditToObsidianCanvas(redditJson);

// Output the canvas JSON
// fs.writeFileSync('output_canvas.json', JSON.stringify(canvasJson, null, 4));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});