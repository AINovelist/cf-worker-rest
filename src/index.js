import { Octokit } from "@octokit/rest";

const topicMap = [
  {
    name: "Air Pollution Reduction",
    slug: "air_pollution_reduction",
    folder: "Air Pollution Reduction",
  },
  {
    name: "Animal Protection",
    slug: "animal_protection",
    folder: "Animal Protection",
  },
  {
    name: "Tree Preservation",
    slug: "tree_preservation",
    folder: "Tree Preservation",
  },
  {
    name: "Waste Reduction",
    slug: "waste_reduction",
    folder: "Waste Reduction",
  },
  {
    name: "Water Conservation",
    slug: "water_conservation",
    folder: "Water Conservation",
  },
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

export default {
  async fetch(request, env, ctx) {
    try {
      const octokit = new Octokit({
        auth: env.GITHUB_TOKEN,
      });

      const url = new URL(request.url);
      const path = url.pathname.split("/");

      if (path[1] === "topicitems") {
        // Return the list of topics
        return new Response(JSON.stringify(topicMap), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      } else if (path[1] === "stories" && path[2] === "topic" && path[3] && path[4]) {
        // Load the .md file from the specific folder
        const topicSlug = path[3];
        const storyId = path[4];
        const topicData = topicMap.find((topic) => topic.slug === topicSlug);

        if (topicData) {
          const filesResponse = await octokit.rest.repos.getContent({
            owner: "AINovelist",
            repo: "stories",
            path: `kids/${topicData.folder}/fa/${storyId}.md`,
            ref: "main",
          });

          if (Array.isArray(filesResponse.data) && filesResponse.data.length > 0) {
            const fileContent = atob(filesResponse.data[0].content);
            return new Response(fileContent, {
              headers: {
                "Content-Type": "text/markdown",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
              },
            });
          } else {
            return new Response("File not found", { status: 404 });
          }
        } else {
          return new Response("Topic not found", { status: 404 });
        }
      } else {
        // Return the original response
        const fileList = [];

        for (const topic of topicMap) {
          const filesResponse = await octokit.rest.repos.getContent({
            owner: "AINovelist",
            repo: "stories",
            path: `kids/${topic.folder}/fa`,
            ref: "main",
          });

          console.log(`Files for topic ${topic.name}:`, filesResponse);

          if (Array.isArray(filesResponse.data)) {
            for (const file of filesResponse.data) {
              const parts = file.name.split("-");
              const suffix = parts[parts.length - 1].replace(".md", "");
              const storyname = file.name.replace(".md", "");
              const imageMap = {};

              for (const imageType of imageTypes) {
                imageMap[imageType] = `${storyname}-${imageType}.png`;
              }

              fileList.push({
                name: file.name,
                topic: topic.name,
                topicSlug: topic.slug,
                images: imageMap,
              });
            }
          } else {
            console.error(`Error fetching files for topic ${topic.name}: ${filesResponse.data.message}`);
          }
        }

        return new Response(JSON.stringify(fileList), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }
    } catch (error) {
      console.error('Error fetching GitHub repository files:', error);
      return new Response('Error fetching GitHub repository files', {
        status: 500,
        statusText: error.message,
      });
    }
  },
};