import { useEffect, useMemo, useRef, useState } from 'react';
import {
  contentApi,
  errorMessage,
  mediaApi,
  type ApiCategory,
  type ApiCategoryKey,
  type ApiJigsawItem,
  type ApiJigsawPieceCount,
  type JigsawItemInput,
} from '@/shared/api';
import {
  Badge,
  Banner,
  Button,
  Card,
  Field,
  Input,
  Loading,
  Select,
  Textarea,
} from '@/shared/components/ui';
import { fallbackJigsawImage } from '@/shared/assets/images';
import { useAsync } from '@/shared/lib/use-async';
import { categoryColor, categoryMeta } from '@/shared/theme/colors';
import JigsawCropper from './jigsaw-cropper';
import JigsawPreview, { defaultPieceCount, PIECE_COUNTS } from './jigsaw-preview';

/**
 * Jigsaw content, one picture per activity.
 *
 * A category has 30 jigsaw activities (5 levels × 6). Each one is assigned its
 * picture here, by hand — the grid is the screen, because "which picture does
 * Level 3 Activity 4 play" is the only question this page exists to answer, and
 * it should be answerable at a glance rather than by clicking through levels.
 *
 * Uploading and assigning are separate steps underneath: pictures belong to the
 * category, and a slot points at one. That is invisible in the common case
 * (choose a slot, upload, done) but means the same picture can be reused across
 * several activities without uploading it twice.
 *
 * An unassigned activity is not broken — it falls back to the category picture,
 * and below that to the image the game ships with. Assign the activities that
 * matter and leave the rest.
 *
 * Each activity also carries its own cut — 6, 9 or 12 pieces. That is a
 * property of the activity rather than of the picture, so one picture reused
 * across three activities can be easy in one and hard in another, and an
 * activity with no picture of its own still has a cut. Left alone it plays the
 * game's ramp (1–2 → 6, 3–4 → 9, 5–6 → 12).
 */

const LEVELS = [1, 2, 3, 4, 5];
const ACTIVITIES = [1, 2, 3, 4, 5, 6];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const slotKey = (level: number, activityNum: number) => `${level}_${activityNum}`;

/** One activity's cut, or `null` while it follows the game's default ramp. */
type SlotCut = ApiJigsawPieceCount | null;

/** The text an admin writes about a picture — the same fields whether adding or editing. */
interface PictureDetails {
  title: string;
  definition_en: string | null;
  definition_tl: string | null;
  context_en: string | null;
  context_tl: string | null;
}

const emptyDetails = (level: string, activityNum: string): PictureDetails => ({
  title: `Level ${level} · Activity ${activityNum}`,
  definition_en: null,
  definition_tl: null,
  context_en: null,
  context_tl: null,
});

export default function JigsawScreen() {
  const [selected, setSelected] = useState<ApiCategoryKey>('history');
  const categories = useAsync(() => contentApi.categories(), []);
  const category = categories.data?.find((c) => c.key === selected) ?? null;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="pill-tabs">
          {categoryMeta.map((meta) => {
            const assigned = Object.keys(
              categories.data?.find((c) => c.key === meta.key)?.jigsawSlots ?? {},
            ).length;
            return (
              <button
                key={meta.key}
                className={`pill-tab ${selected === meta.key ? 'pill-tab--active' : ''}`}
                style={selected === meta.key ? { background: categoryColor(meta.key) } : undefined}
                onClick={() => setSelected(meta.key)}
              >
                {meta.label}
                {assigned > 0 && <span className="pill-tab__count">{assigned}/30</span>}
              </button>
            );
          })}
        </div>
        <Button variant="secondary" small onClick={categories.reload}>
          Refresh
        </Button>
      </div>

      {categories.loading ? (
        <Loading label="Loading jigsaw content…" />
      ) : categories.error ? (
        <Banner tone="error">{categories.error}</Banner>
      ) : category ? (
        <CategoryJigsaws key={category.key} category={category} onSaved={categories.reload} />
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- category */

function CategoryJigsaws({ category, onSaved }: { category: ApiCategory; onSaved: () => void }) {
  const [items, setItems] = useState<ApiJigsawItem[]>(category.jigsaws);
  const [slots, setSlots] = useState<Record<string, string>>(category.jigsawSlots);
  const [pieces, setPieces] = useState<Record<string, ApiJigsawPieceCount>>(category.jigsawPieces);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [openSlot, setOpenSlot] = useState<string | null>(slotKey(1, 1));
  const [pending, setPending] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(category.jigsaws);
    setSlots(category.jigsawSlots);
    setPieces(category.jigsawPieces);
    setSelectedLevel(1);
    setOpenSlot(slotKey(1, 1));
  }, [category]);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const assignedCount = Object.keys(slots).length;

  const openItem = openSlot ? (itemById.get(slots[openSlot] ?? '') ?? null) : null;

  /** Every write sends the whole set, so assign/edit/clear/cut share one path. */
  const persist = async (
    nextItems: JigsawItemInput[],
    nextSlots: Record<string, string>,
    nextPieces: Record<string, ApiJigsawPieceCount>,
    message: string,
  ) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await contentApi.replaceJigsaws(
        category.key,
        nextItems,
        nextSlots,
        nextPieces,
      );
      setItems(saved.items);
      setSlots(saved.slots);
      setPieces(saved.pieces);
      setNotice(message);
      onSaved();
      return saved;
    } catch (err) {
      setError(errorMessage(err, 'The change could not be saved.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file (JPG, PNG or WebP).');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('That image is larger than 5 MB. Choose a smaller one.');
      return;
    }
    setError(null);
    setNotice(null);
    setPending(file);
  };

  /**
   * Uploads the cropped square and assigns it to the open activity, with the
   * text the admin wrote alongside it.
   *
   * One save, not two: the id is minted here rather than server-side, so the
   * picture and the slot pointing at it land in the same request. A half-done
   * add — a picture nothing plays, or a slot pointing at nothing — is then not
   * a state that can exist.
   */
  const createForSlot = async (square: File, details: PictureDetails, cut: SlotCut) => {
    if (!openSlot) return;
    setPending(null);
    if (fileInput.current) fileInput.current.value = '';

    setBusy(true);
    setError(null);
    try {
      const imageUrl = await mediaApi.upload(square, 'category-image', {
        categoryKey: category.key,
      });
      const id = crypto.randomUUID();

      await persist(
        [...items, { id, imageUrl, ...details }],
        { ...slots, [openSlot]: id },
        piecesWith(openSlot, cut),
        'Picture and mini-lesson saved. Students see the lesson when they finish this puzzle.',
      );
    } catch (err) {
      setError(errorMessage(err, 'The picture could not be uploaded.'));
    } finally {
      setBusy(false);
    }
  };

  const assignExisting = (id: string) => {
    if (!openSlot) return;
    void persist(items, { ...slots, [openSlot]: id }, pieces, 'Picture assigned to this activity.');
  };

  const clearSlot = () => {
    if (!openSlot) return;
    const next = { ...slots };
    delete next[openSlot];
    void persist(
      items,
      next,
      pieces,
      'Activity cleared — it falls back to the category picture.',
    );
  };

  const saveItem = (patch: ApiJigsawItem, cut: SlotCut) =>
    persist(
      items.map((item) => (item.id === patch.id ? patch : item)),
      slots,
      openSlot ? piecesWith(openSlot, cut) : pieces,
      'Saved.',
    );

  /**
   * The cut map with one activity's choice applied.
   *
   * `null` removes the entry rather than storing a number, so the activity goes
   * back to following the game's ramp instead of being pinned to whatever the
   * ramp happens to say today.
   */
  const piecesWith = (slot: string, cut: SlotCut) => {
    const next = { ...pieces };
    if (cut === null) delete next[slot];
    else next[slot] = cut;
    return next;
  };

  /** For an activity whose cut is the only thing that changed. */
  const saveCut = (cut: SlotCut) => {
    if (!openSlot) return;
    const [level, activityNum] = openSlot.split('_');
    void persist(
      items,
      slots,
      piecesWith(openSlot, cut),
      cut === null
        ? `Level ${level} · Activity ${activityNum} follows the default cut again — ${defaultPieceCount(Number(activityNum))} pieces.`
        : `Level ${level} · Activity ${activityNum} is now cut into ${cut} pieces.`,
    );
  };

  /**
   * Deletes the picture itself, not just this activity's use of it.
   *
   * Every activity pointing at it is unassigned in the same request: the API
   * rejects a slot referencing a picture that is not in `items`, and an admin
   * deleting a picture from one activity should not be surprised by it
   * surviving in another. The cuts are left alone — they belong to the
   * activities, which still play, on the category fallback.
   *
   * The uploaded file stays in Cloud Storage; nothing links to it any more.
   */
  const deleteItem = () => {
    if (!openItem) return;
    const usedBy = Object.values(slots).filter((id) => id === openItem.id).length;
    const warning =
      usedBy > 1
        ? `Delete “${openItem.title}”? It is assigned to ${usedBy} activities — all of them fall back to the category picture.`
        : `Delete “${openItem.title}”? This activity falls back to the category picture.`;
    if (!window.confirm(warning)) return;

    void persist(
      items.filter((item) => item.id !== openItem.id),
      Object.fromEntries(Object.entries(slots).filter(([, id]) => id !== openItem.id)),
      pieces,
      usedBy > 1
        ? `Picture deleted. ${usedBy} activities fall back to the category picture.`
        : 'Picture deleted — this activity falls back to the category picture.',
    );
  };

  return (
    <>
      {error && <Banner tone="error">{error}</Banner>}
      {notice && !error && <Banner tone="success">{notice}</Banner>}

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => pickFile(e.target.files?.[0])}
      />

      <section className="jigsaw-overview">
        <div>
          <div className="jigsaw-overview__eyebrow">{category.label} collection</div>
          <h2>Choose an activity to edit</h2>
          <p>{assignedCount} of 30 activities ready</p>
        </div>
        <div className="jigsaw-progress" aria-label={`${assignedCount} of 30 activities ready`}>
          <span style={{ width: `${(assignedCount / 30) * 100}%`, background: categoryColor(category.key) }} />
        </div>
      </section>

      <nav className="jigsaw-levels" aria-label="Jigsaw levels">
        {LEVELS.map((level) => {
          const ready = ACTIVITIES.filter((activity) => slots[slotKey(level, activity)]).length;
          return (
            <button
              key={level}
              className={`jigsaw-level ${selectedLevel === level ? 'jigsaw-level--active' : ''}`}
              onClick={() => {
                setSelectedLevel(level);
                setOpenSlot(slotKey(level, 1));
              }}
            >
              <span>Level {level}</span>
              <small>{ready}/6 ready</small>
            </button>
          );
        })}
      </nav>

      <div className="jigsaw-workspace">
        <section className="jigsaw-workspace__activities" aria-label={`Level ${selectedLevel} activities`}>
          <div className="jigsaw-section-heading">
            <div><span className="jigsaw-overview__eyebrow">Level {selectedLevel}</span><h3>Activities</h3></div>
            <span className="field__hint">Select a card to edit</span>
          </div>
          <div className="jigsaw-activity-grid">
            {ACTIVITIES.map((activityNum) => {
              const key = slotKey(selectedLevel, activityNum);
              const item = itemById.get(slots[key] ?? '');
              const chosenCut = pieces[key];
              const cut = chosenCut ?? defaultPieceCount(activityNum);
              return (
                <button
                  key={activityNum}
                  className={`jigsaw-activity-card ${openSlot === key ? 'jigsaw-activity-card--active' : ''} ${item ? '' : 'jigsaw-activity-card--empty'}`}
                  onClick={() => setOpenSlot(key)}
                  aria-pressed={openSlot === key}
                >
                  {item ? <img src={item.imageUrl} alt="" /> : <span className="jigsaw-activity-card__empty" aria-hidden>+</span>}
                  <span className="jigsaw-activity-card__body">
                    <span className="jigsaw-activity-card__topline"><strong>Activity {activityNum}</strong><span className={`slot__cut ${chosenCut ? 'slot__cut--set' : ''}`}>{cut} pcs</span></span>
                    <span className="jigsaw-activity-card__title">{item?.title ?? 'Add a picture'}</span>
                    <span className={`jigsaw-activity-card__status ${item ? 'jigsaw-activity-card__status--ready' : ''}`}>{item ? 'Ready' : 'Needs picture'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="jigsaw-workspace__editor">
          {openSlot && (
            <SlotEditor
              slot={openSlot}
              item={openItem}
              items={items}
              chosenPieces={pieces[openSlot] ?? null}
              busy={busy}
              pending={pending}
              fallbackUrl={category.imageUrl ?? fallbackJigsawImage[category.key]}
              onUploadClick={() => fileInput.current?.click()}
              onClearPending={() => { setPending(null); if (fileInput.current) fileInput.current.value = ''; }}
              onCreate={createForSlot}
              onAssign={assignExisting}
              onClear={clearSlot}
              onDelete={deleteItem}
              onSaveItem={saveItem}
              onSaveCut={saveCut}
              onClose={() => setOpenSlot(null)}
            />
          )}
        </aside>
      </div>

      <CategoryFallback category={category} onSaved={onSaved} />
    </>
  );
}

/* -------------------------------------------------------------- slot editor */

function SlotEditor({
  slot,
  item,
  items,
  chosenPieces,
  busy,
  pending,
  fallbackUrl,
  onUploadClick,
  onClearPending,
  onCreate,
  onAssign,
  onClear,
  onDelete,
  onSaveItem,
  onSaveCut,
  onClose,
}: {
  slot: string;
  item: ApiJigsawItem | null;
  items: ApiJigsawItem[];
  /** The stored cut, or null while this activity follows the ramp. */
  chosenPieces: SlotCut;
  busy: boolean;
  pending: File | null;
  fallbackUrl: string;
  onUploadClick: () => void;
  /** Drops the picked file, whether the crop was confirmed or abandoned. */
  onClearPending: () => void;
  onCreate: (square: File, details: PictureDetails, cut: SlotCut) => void;
  onAssign: (id: string) => void;
  /** Unassigns this activity; the picture stays in the category. */
  onClear: () => void;
  /** Deletes the picture from the category, unassigning every activity on it. */
  onDelete: () => void;
  onSaveItem: (item: ApiJigsawItem, cut: SlotCut) => Promise<unknown>;
  /** For an activity with no picture, where the cut is all there is to save. */
  onSaveCut: (cut: SlotCut) => void;
  onClose: () => void;
}) {
  const [level, activityNum] = slot.split('_');
  const rampPieces = defaultPieceCount(Number(activityNum));

  /**
   * The add flow is crop → write → save, so the cropped square is held here
   * until the text is written. Writing the mini-lesson is part of adding the
   * picture rather than a second visit to the same screen — the lesson is the
   * point of the activity, and an upload flow that ends before it invites
   * pictures with nothing to teach.
   */
  const [square, setSquare] = useState<File | null>(null);
  const [draft, setDraft] = useState<PictureDetails>(emptyDetails(level, activityNum));
  // The cut is a draft like the rest of the form: it goes out with Save, not on
  // the change, so one trip through this editor is one write.
  const [cut, setCut] = useState<SlotCut>(chosenPieces);
  const [problem, setProblem] = useState<string | null>(null);

  // Reopening on a different activity, or on one whose picture changed, starts
  // the form from what is actually stored.
  useEffect(() => {
    setSquare(null);
    setDraft(item ?? emptyDetails(level, activityNum));
    setCut(chosenPieces);
    setProblem(null);
  }, [item, chosenPieces, level, activityNum]);

  const patch = (next: Partial<PictureDetails>) =>
    setDraft((current) => ({ ...current, ...next }));

  // The preview cuts the picture the way this activity will once saved, so an
  // admin sees the board a student gets rather than a generic one.
  const pieceCount = cut ?? rampPieces;

  const save = () => {
    // An activity with no picture has nothing to name — the cut is the whole
    // form, so the title rule would only be in the way.
    if (!item && !square) {
      setProblem(null);
      onSaveCut(cut);
      return;
    }

    if (!draft.title.trim()) {
      setProblem('Give the picture a name — it is the caption a student sees.');
      return;
    }
    setProblem(null);

    const details: PictureDetails = {
      title: draft.title.trim(),
      definition_en: draft.definition_en?.trim() || null,
      definition_tl: draft.definition_tl?.trim() || null,
      context_en: draft.context_en?.trim() || null,
      context_tl: draft.context_tl?.trim() || null,
    };

    if (square) onCreate(square, details, cut);
    else if (item) void onSaveItem({ ...item, ...details }, cut);
  };

  /** Pictures already uploaded to this category, minus the one already here. */
  const reusable = items.filter((candidate) => candidate.id !== item?.id);

  // Created once per cropped file and revoked when it is replaced or discarded —
  // minting one in the render body would leak a URL on every keystroke in the
  // form below.
  const [squareUrl, setSquareUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!square) {
      setSquareUrl(null);
      return;
    }
    const url = URL.createObjectURL(square);
    setSquareUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [square]);

  const previewUrl = squareUrl ?? item?.imageUrl ?? fallbackUrl;

  return (
    <Card
      title={`Level ${level} · Activity ${activityNum}`}
      hint={
        square
          ? 'Write what this picture teaches, then save.'
          : item
            ? 'This activity plays the picture below.'
            : 'No picture set for this activity yet.'
      }
      actions={
        <>
          {item && !square && (
            <>
              {/* Two different retreats: Clear frees this activity and keeps the
                  picture for reuse, Delete removes the picture from the
                  category altogether. */}
              <Button variant="danger" small onClick={onDelete} disabled={busy}>
                Delete picture
              </Button>
              <Button variant="secondary" small onClick={onClear} disabled={busy}>
                Clear
              </Button>
            </>
          )}
          {!square && (
            <Button small onClick={onUploadClick} busy={busy} disabled={!!pending}>
              {item ? 'Replace picture' : 'Upload picture'}
            </Button>
          )}
          <Button variant="ghost" small onClick={onClose}>
            ✕
          </Button>
        </>
      }
    >
      {pending ? (
        <JigsawCropper
          file={pending}
          onCancel={onClearPending}
          onConfirm={(cropped) => {
            setSquare(cropped);
            // The picked file has served its purpose; leaving it set would keep
            // the cropper mounted over the form that comes next.
            onClearPending();
          }}
        />
      ) : (
        <div className="grid grid--2">
          <div className="grid" style={{ gap: 10, alignContent: 'start' }}>
            <JigsawPreview imageUrl={previewUrl} pieceCount={pieceCount} />
            {!item && !square && (
              <Banner tone="info">
                This is the category picture, which is what a student sees until you set one here.
              </Banner>
            )}
            {square && <Banner tone="info">Not saved yet — fill in the text and save.</Banner>}
          </div>

          <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
            {problem && <Banner tone="error">{problem}</Banner>}

            <Field
              label="Pieces"
              hint={
                cut === null
                  ? `Following the game's default for activity ${activityNum} — ${rampPieces} pieces. The preview re-cuts as you change this; save to keep it.`
                  : 'The board students play. The preview re-cuts as you change this; save to keep it.'
              }
            >
              <Select
                value={cut ?? 'default'}
                disabled={busy}
                onChange={(e) =>
                  setCut(
                    e.target.value === 'default'
                      ? null
                      : (Number(e.target.value) as ApiJigsawPieceCount),
                  )
                }
              >
                <option value="default">Default · {rampPieces} pieces</option>
                {PIECE_COUNTS.map((option) => (
                  <option key={option.count} value={option.count}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            {item || square ? (
              <>
                <Field label="Name" hint="Shown as the caption when the puzzle is completed.">
                  <Input
                    value={draft.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    placeholder="Ang Katipunan"
                    maxLength={80}
                  />
                </Field>

                <Field label="Definition — Tagalog" hint="One line, shown with the finished picture.">
                  <Input
                    value={draft.definition_tl ?? ''}
                    onChange={(e) => patch({ definition_tl: e.target.value })}
                    placeholder="Ang lihim na samahang nagsimula ng himagsikan noong 1896."
                    maxLength={400}
                  />
                </Field>

                <Field label="Definition — English">
                  <Input
                    value={draft.definition_en ?? ''}
                    onChange={(e) => patch({ definition_en: e.target.value })}
                    placeholder="The secret society that started the 1896 revolution."
                    maxLength={400}
                  />
                </Field>

                <Field
                  label="Mini-lesson — Tagalog"
                  hint="Shown to the student the moment they finish this puzzle."
                >
                  <Textarea
                    value={draft.context_tl ?? ''}
                    onChange={(e) => patch({ context_tl: e.target.value })}
                    placeholder="Ang Katipunan (KKK) ay isang lihim na samahang Pilipino na itinatag ni Andres Bonifacio noong 1892…"
                    maxLength={4000}
                  />
                </Field>

                <Field label="Mini-lesson — English">
                  <Textarea
                    value={draft.context_en ?? ''}
                    onChange={(e) => patch({ context_en: e.target.value })}
                    placeholder="The Katipunan (KKK) was a secret Filipino society founded by Andres Bonifacio in 1892…"
                    maxLength={4000}
                  />
                </Field>
              </>
            ) : (
              <>
                <div>
                  <div className="field__label">Upload a picture for this activity</div>
                  <div className="field__hint">
                    You choose the square after picking a file, then write the mini-lesson that goes
                    with it — the board is square, and the lesson is what a student gets for solving
                    it.
                  </div>
                </div>

                {reusable.length > 0 && (
                  <>
                    <div className="field__label">…or reuse one already in this category</div>
                    <div className="library">
                      {reusable.map((candidate) => (
                        <button
                          key={candidate.id}
                          className="library__tile"
                          onClick={() => onAssign(candidate.id)}
                          disabled={busy}
                        >
                          <img src={candidate.imageUrl} alt="" className="thumb" />
                          <span className="library__title">{candidate.title}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* One Save for the whole editor — the cut goes out with the text
                it sits beside, so an activity is never half-written. */}
            <div className="row">
              <Button onClick={save} busy={busy}>
                {square ? 'Save picture & lesson' : item ? 'Save details' : 'Save cut'}
              </Button>
              {square && (
                <Button variant="secondary" onClick={() => setSquare(null)} disabled={busy}>
                  Discard
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- fallback */

function CategoryFallback({
  category,
  onSaved,
}: {
  category: ApiCategory;
  onSaved: () => void;
}) {
  const [context, setContext] = useState(category.context_tl ?? '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setContext(category.context_tl ?? ''), [category]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await contentApi.updateCategory(category.key, { context_tl: context.trim() || null });
      setNotice('Saved.');
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'The mini-lesson could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Category fallback"
      hint="Used by the mini-lesson list, and by any activity with no picture of its own"
      actions={
        <Button variant="secondary" small onClick={save} busy={busy}>
          Save
        </Button>
      }
    >
      <div className="grid grid--2">
        <div>
          <div className="field__label" style={{ marginBottom: 6 }}>
            Picture
          </div>
          <img
            src={category.imageUrl ?? fallbackJigsawImage[category.key]}
            alt=""
            className="thumb"
            style={{ maxWidth: 200 }}
          />
          <div className="field__hint" style={{ marginTop: 6 }}>
            {category.imageUrl ? (
              <Badge tone="green">Uploaded</Badge>
            ) : (
              <Badge>The image the game ships with</Badge>
            )}
          </div>
        </div>

        <Field label="Mini-lesson — Tagalog" hint="Shown on the category's mini-lesson card.">
          <Textarea value={context} onChange={(e) => setContext(e.target.value)} maxLength={4000} />
        </Field>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {notice && !error && <Banner tone="success">{notice}</Banner>}
    </Card>
  );
}
