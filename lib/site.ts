// Site-wide links in one place. Change them here and every page updates.

/** My GitHub profile. */
export const GITHUB_URL = "https://github.com/OonXiangYu";

/** The source code of this website. */
export const REPO_URL = "https://github.com/OonXiangYu/draw_oscar";

/** My LinkedIn profile. */
export const LINKEDIN_URL = "https://www.linkedin.com/in/oscaroon";

/** Where the training drawings come from (credit required by CC BY 4.0). */
export const DATASET_URL = "https://github.com/googlecreativelab/quickdraw-dataset";

/**
 * Spread these on every link to another site: <a href={...} {...EXTERNAL_LINK}>.
 * It opens a new tab, and "noopener noreferrer" stops the new page from
 * controlling this tab or seeing where the visitor came from.
 */
export const EXTERNAL_LINK = { target: "_blank", rel: "noopener noreferrer" } as const;
