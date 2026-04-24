import axios from "axios";

const META_GRAPH_BASE = "https://graph.facebook.com/v20.0";

type InstagramPublishInput = {
  igUserId: string;
  accessToken: string;
  caption: string;
  mediaUrls: string[];
};

type InstagramPublishResult = {
  platformPostId: string;
  raw: unknown;
};

const createMediaContainer = async (
  igUserId: string,
  accessToken: string,
  params: Record<string, string>
) => {
  const response = await axios.post(
    `${META_GRAPH_BASE}/${igUserId}/media`,
    new URLSearchParams({ access_token: accessToken, ...params }).toString(),
    { headers: { "content-type": "application/x-www-form-urlencoded" } }
  );
  return response.data?.id as string;
};

const publishContainer = async (igUserId: string, accessToken: string, creationId: string) => {
  const response = await axios.post(
    `${META_GRAPH_BASE}/${igUserId}/media_publish`,
    new URLSearchParams({ access_token: accessToken, creation_id: creationId }).toString(),
    { headers: { "content-type": "application/x-www-form-urlencoded" } }
  );
  return response.data;
};

export const publishInstagram = async (input: InstagramPublishInput): Promise<InstagramPublishResult> => {
  if (!input.mediaUrls.length) {
    throw new Error("instagram publish requires at least one media url");
  }

  let creationId: string;
  if (input.mediaUrls.length === 1) {
    creationId = await createMediaContainer(input.igUserId, input.accessToken, {
      image_url: input.mediaUrls[0],
      caption: input.caption
    });
  } else {
    const childIds: string[] = [];
    for (const mediaUrl of input.mediaUrls) {
      const childId = await createMediaContainer(input.igUserId, input.accessToken, {
        image_url: mediaUrl,
        is_carousel_item: "true"
      });
      childIds.push(childId);
    }
    creationId = await createMediaContainer(input.igUserId, input.accessToken, {
      media_type: "CAROUSEL",
      caption: input.caption,
      children: childIds.join(",")
    });
  }

  const published = await publishContainer(input.igUserId, input.accessToken, creationId);
  return { platformPostId: String(published.id), raw: published };
};
