/** Owner-run setup only. No web endpoint, mail, triggers, or response deletion. */
const FEEDBACK_TITLE = '委託販売ノート｜ご意見・ご要望（返信不要）';
const FEEDBACK_DESCRIPTION = '使いにくかったところ、気になった点、あったら便利なことなどをお聞かせください。\n名前・メールアドレスは不要です。個別の返信は行いません。\n返信が必要な方は、お問い合わせフォームをご利用ください。\nhttps://hiroappworks.com/contact/';
const FEEDBACK_CONFIRMATION = 'ご意見ありがとうございます。今後の改善の参考にします。\nこのフォームへの個別の返信は行いません。\n返信が必要な方は、お問い合わせフォームをご利用ください。';

function setupFeedbackForm_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    let id = props.getProperty('FEEDBACK_FORM_ID');
    if (!id) {
      if (props.getProperty('FEEDBACK_CREATION_STARTED')) {
        throw new Error('Creation interrupted: recover the created form ID before retrying.');
      }
      props.setProperty('FEEDBACK_CREATION_STARTED', new Date().toISOString());
      const created = FormApp.create(FEEDBACK_TITLE, false);
      id = created.getId();
      props.setProperty('FEEDBACK_FORM_ID', id);
      console.log('Created form ID: ' + id);
    }
    if (props.getProperty('FEEDBACK_SETUP_COMPLETE') === 'true') {
      return verifyFeedbackForm_();
    }
    const form = FormApp.openById(id);
    // A newly created form can display a file name while getTitle() is empty.
    // Only recover the recorded dedicated form during incomplete setup.
    if (form.getTitle() === '') form.setTitle(FEEDBACK_TITLE);
    if (form.getTitle() !== FEEDBACK_TITLE) throw new Error('Unexpected form title.');
    const items = form.getItems();
    if (items.length > 1 || (items.length === 1 && items[0].getType() !== FormApp.ItemType.PARAGRAPH_TEXT)) {
      throw new Error('Unexpected form structure; no changes made to questions.');
    }
    form.setDescription(FEEDBACK_DESCRIPTION)
      .setConfirmationMessage(FEEDBACK_CONFIRMATION)
      .setCollectEmail(false).setLimitOneResponsePerUser(false)
      .setAllowResponseEdits(false).setPublishingSummary(false)
      .setIsQuiz(false).setShowLinkToRespondAgain(false);
    const item = items.length ? items[0].asParagraphTextItem() : form.addParagraphTextItem();
    props.setProperty('FEEDBACK_ITEM_ID', String(item.getId()));
    item.setTitle('ご意見・ご要望').setHelpText('一言でも構いません。').setRequired(true);
    form.setPublished(false);
    props.setProperty('FEEDBACK_SETUP_COMPLETE', 'true');
    return verifyFeedbackForm_();
  } finally {
    lock.releaseLock();
  }
}

function verifyFeedbackForm_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FEEDBACK_FORM_ID');
  if (!id) throw new Error('Run setup first; do not enter an unrelated form ID.');
  const form = FormApp.openById(id);
  const items = form.getItems();
  if (form.getTitle() !== FEEDBACK_TITLE || items.length !== 1 ||
      items[0].getType() !== FormApp.ItemType.PARAGRAPH_TEXT ||
      String(items[0].getId()) !== props.getProperty('FEEDBACK_ITEM_ID')) {
    throw new Error('Dedicated form identity or question structure mismatch.');
  }
  const item = items[0].asParagraphTextItem();
  if (item.getTitle() !== 'ご意見・ご要望' || !item.isRequired() ||
      item.getHelpText() !== '一言でも構いません。' ||
      form.getDescription() !== FEEDBACK_DESCRIPTION ||
      form.getConfirmationMessage() !== FEEDBACK_CONFIRMATION ||
      form.collectsEmail() || form.hasLimitOneResponsePerUser() ||
      form.canEditResponse() || form.isPublishingSummary() || form.isQuiz()) {
    throw new Error('Settings mismatch; inspect without automatically rewriting.');
  }
  const result = {formId:id, itemId:item.getId(), editUrl:form.getEditUrl(),
    questions:items.length, required:item.isRequired(), collectsEmail:form.collectsEmail(),
    published:form.isPublished(), acceptingResponses:form.isAcceptingResponses(),
    // Editor count is not a sharing audit; inspect owner and general access in UI.
    editorsReported:form.getEditors().length, responses:form.getResponses().length};
  console.log(JSON.stringify(result));
  return result;
}

/** Explicit QA operation only. Reuses marked responses after partial failure. */
function saveQaResponsesOnce_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    verifyFeedbackForm_();
    const props = PropertiesService.getScriptProperties();
    const form = FormApp.openById(props.getProperty('FEEDBACK_FORM_ID'));
    const item = form.getItemById(Number(props.getProperty('FEEDBACK_ITEM_ID'))).asParagraphTextItem();
    let marker = props.getProperty('FEEDBACK_QA_MARKER');
    if (!marker) {
      marker = '[QA feedback ' + Utilities.getUuid() + ']';
      props.setProperty('FEEDBACK_QA_MARKER', marker);
    }
    const fixtures = [{key:'JA', text:marker + ' ご意見保存の確認'},
      {key:'EN', text:marker + ' Feedback storage check'}];
    fixtures.forEach(function (fixture) {
      const key = 'FEEDBACK_QA_RESPONSE_' + fixture.key;
      let responseId = props.getProperty(key);
      if (!responseId) {
        const matches = form.getResponses().filter(function (response) {
          const answers = response.getItemResponses();
          return answers.length === 1 && answers[0].getItem().getId() === item.getId() &&
            answers[0].getResponse() === fixture.text;
        });
        if (matches.length > 1) throw new Error('Duplicate QA responses require manual review.');
        const saved = matches.length ? matches[0] : form.createResponse()
          .withItemResponse(item.createResponse(fixture.text)).submit();
        responseId = saved.getId();
        props.setProperty(key, responseId);
      }
      const readBack = form.getResponse(responseId);
      const answers = readBack.getItemResponses();
      if (answers.length !== 1 || answers[0].getItem().getId() !== item.getId() ||
          answers[0].getResponse() !== fixture.text || readBack.getRespondentEmail()) {
        throw new Error('QA persisted response mismatch or unexpected email.');
      }
      console.log(fixture.key + ': persisted=true, emailAbsent=true');
    });
    verifyFeedbackForm_();
  } finally {
    lock.releaseLock();
  }
}
