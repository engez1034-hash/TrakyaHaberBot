import axios from "axios";

const META_GRAPH_BASE = "https://graph.facebook.com/v20.0";

type FacebookPublishInput = {
  pageId: string;
  accessToken: string;
  message: string;
  link: string;
  mediaUrls?: string[];
};

type FacebookPublishResult = {
  platformPostId: string;
  raw: unknown;
};

const uploadPhoto = async (pageId: string, accessToken: string, url: string, caption?: string) => {
  const response = await axios.post(
    `${META_GRAPH_BASE}/${pageId}/photos`,
    new URLSearchParams({
      access_token: accessToken,
      url,
      published: "true",
      ...(caption ? { caption } : {})
    }).toString(),
    { headers: { "content-type": "application/x-www-form-urlencoded" } }
  );
  return response.data;
};

const createFeedPost = async (pageId: string, accessToken: string, message: string, link: string) => {
  const response = await axios.post(
    `${META_GRAPH_BASE}/${pageId}/feed`,
    new URLSearchParams({
      access_token: accessToken,
      message,
      link
    }).toString(),
    { headers: { "content-type": "application/x-www-form-urlencoded" } }
  );
  return response.data;
};

export const publishFacebook = async (input: FacebookPublishInput): Promise<FacebookPublishResult> => {
  if (input.mediaUrls?.length) {
    const uploaded = await uploadPhoto(input.pageId, input.accessToken, input.mediaUrls[0], input.message);
    return { platformPostId: String(uploaded.post_id ?? uploaded.id), raw: uploaded };
  }

  const feedPost = await createFeedPost(input.pageId, input.accessToken, input.message, input.link);
  return { platformPostId: String(feedPost.id), raw: feedPost };
};
