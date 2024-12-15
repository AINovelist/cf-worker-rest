import { Octokit } from "@octokit/rest";
const REPO_OWNER = 'AINovelist';
const REPO_NAME = 'stories';
const ROOT_FOLDER = 'kids';
const PER_PAGE = 100; // Default pagination limit
const topicMap = [
  { name: "Air Pollution Reduction", slug: "air_pollution_reduction", folder: "Air Pollution Reduction" },
  { name: "Animal Protection", slug: "animal_protection", folder: "Animal Protection" },
  { name: "Tree Preservation", slug: "tree_preservation", folder: "Tree Preservation" },
  { name: "Waste Reduction", slug: "waste_reduction", folder: "Waste Reduction" },
  { name: "Water Conservation", slug: "water_conservation", folder: "Water Conservation" },
];
const imageTypes = [
  "3d_rendered",
  "cartoon",
  "chibi",
  "flat_design",
  "hand_drawn",
  "real",
  "storybook_illustration",
  "vector_art",
  "watercolor",
];
function generateImageList(fileName) {
  const baseFileName = fileName.replace('.md', '');
  return imageTypes.reduce((images, type) => {
    images[type] = `${baseFileName}-${type}.png`;
    return images;
  }, {});
}

function generatePagesImageList(fileName) {
  const baseFileName = fileName.replace('.json', '');
  return imageTypes.reduce((images, type) => {
    images[type] = [];
    for (let i = 1; i <= 5; i++) {
      images[type].push(`${baseFileName}/${i}-${type}.png`);
    }
    return images;
  }, {});
}

async function listFilesInTopic(octokit, topicSlug, env) {
  const topic = topicMap.find((t) => t.slug === topicSlug);
  if (!topic) {
    throw new Error(`Topic not found for slug: ${topicSlug}`);
  }
  const folderPath = `${ROOT_FOLDER}/${topic.folder}/fa`;
  const response = await octokit.repos.getContent({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path: folderPath,
    auth: env.GITHUB_TOKEN,
  });

  // Filter the list to only include .md files
  return response.data
    .filter((item) => item.name.endsWith('.md')) // Filter for .md files only
    .map((item) => ({
      name: item.name,
      type: item.type,
      download_url: item.download_url,
      images: generateImageList(item.name),
    }));
}

async function listJsonFilesInTopic(octokit, topicSlug, env) {
  const topic = topicMap.find((t) => t.slug === topicSlug);

  if (!topic) {
    throw new Error(`Topic not found for slug: ${topicSlug}`);
  }

  const folderPath = `${ROOT_FOLDER}/${topic.folder}/fa`;

  const response = await octokit.repos.getContent({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path: folderPath,
    headers: {
      Authorization: `Bearer ` + env.GITHUB_TOKEN,
    },
  });

  const jsonFiles = response.data
    .filter((item) => item.name.endsWith('.json')) // Filter for .json files only
    .map((item) => ({
      name: item.name,
      type: item.type,
      download_url: item.download_url,
      images: generatePagesImageList(item.name),
    }));

  // Fetch the content of each .json file and add it to the response
  for (let file of jsonFiles) {
    const fileContentResponse = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `${folderPath}/${file.name}`,
      headers: {
        Authorization: `Bearer ` + env.GITHUB_TOKEN,
      },
    });
    console.log(atob(fileContentResponse.data.content));
    // Decode the content from base64
    const content = JSON.parse(decodeURIComponent(escape(atob(fileContentResponse.data.content))));
    content.pages = content.pages.map((page) => {
      const { image_prompt, ...rest } = page;
      return rest;
    });
    file.content = content;
  }

  return jsonFiles;
}

async function getTopics(env) {
  return topicMap;
}

async function getContentByTopicAndFile(octokit, topicSlug, fileName, env) {
  const topic = topicMap.find((t) => t.slug === topicSlug);
  const folderPath = `${ROOT_FOLDER}/${topic.folder}/fa/${fileName}.md`;
  const response = await octokit.repos.getContent({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path: folderPath,
    auth: env.GITHUB_TOKEN,
  });

  // const content = atob(response.data.content);
  const content = decodeURIComponent(escape(atob(response.data.content)))
  const images = generateImageList(fileName);

  return { content, images };
}

async function searchFiles(octokit, keyword, env) {
  const response = await octokit.search.code({
    q: `${keyword} in:file extension:md repo:${REPO_OWNER}/${REPO_NAME}`,
    per_page: PER_PAGE, // Increase limit for search results
    auth: env.GITHUB_TOKEN,
  });

  return response.data.items.map((item) => ({
    name: item.name,
    path: item.path,
    download_url: item.html_url.replace('/blob/', '/raw/'),    
  }));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
    try {
      if (pathname === '/') {
        const files = [];
        for (const topic of topicMap) {
          const topicFiles = await listFilesInTopic(octokit, topic.slug, env);
          files.push(...topicFiles.map((file) => ({ ...file, topic: topic.name, topicSlug: topic.slug })));
        }
        return new Response(JSON.stringify(files), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
       } else if (pathname === '/paged') {
        const files = [];
        for (const topic of topicMap) {
          const topicFiles = await listJsonFilesInTopic(octokit, topic.slug, env);
          files.push(...topicFiles.map((file) => ({ ...file, topic: topic.name, topicSlug: topic.slug })));
        }
        return new Response(JSON.stringify(files), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }else if (pathname === '/topic') {
        const topics = await getTopics();
        return new Response(JSON.stringify(topics), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      } else if (pathname.startsWith('/topic/')) {
        const parts = pathname.split('/');
        const topicSlug = parts[2];

        // Check if there's a file name in the path
        if (parts.length === 4) {
          const fileName = parts[3];
          const { content, images } = await getContentByTopicAndFile(octokit, topicSlug, fileName, env);
          return new Response(JSON.stringify({ content, images }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
          });
        } else {
          // Load the list of files for the specified topic
          const files = await listFilesInTopic(octokit,topicSlug, env);
          // (octokit, topicSlug, fileName, env)
          return new Response(JSON.stringify(files), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
          });
        }
      } else if (pathname.startsWith('/search/')) {
        const keyword = pathname.split('/')[2];
        const files = await searchFiles(keyword);
        return new Response(JSON.stringify(files), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      } else {
        return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error(error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};