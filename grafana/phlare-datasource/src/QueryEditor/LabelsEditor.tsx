import React, { useEffect, useRef } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, Monaco, useStyles2, monacoTypes } from '@grafana/ui';
import type { languages } from 'monaco-editor';
import { useLatest } from 'react-use';

import { languageDefinition } from '../phlareql';
import { CompletionProvider } from './autocomplete';
import { SeriesMessage } from '../types';

interface Props {
  value: string;
  onChange: (val: string) => void;
  onRunQuery: (value: string) => void;
  series?: SeriesMessage;
}

export function LabelsEditor(props: Props) {
  const setupAutocompleteFn = useAutocomplete(props.series);
  const styles = useStyles2(getStyles);

  const onRunQueryRef = useLatest(props.onRunQuery);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={styles.wrapper}
      // NOTE: we will be setting inline-style-width/height on this element
      ref={containerRef}
    >
      <CodeEditor
        value={props.value}
        language={langId}
        onBlur={props.onChange}
        containerStyles={styles.queryField}
        monacoOptions={{
          folding: false,
          fontSize: 14,
          lineNumbers: 'off',
          overviewRulerLanes: 0,
          renderLineHighlight: 'none',
          scrollbar: {
            vertical: 'hidden',
            verticalScrollbarSize: 8, // used as "padding-right"
            horizontal: 'hidden',
            horizontalScrollbarSize: 0,
          },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          padding: {
            top: 5,
            bottom: 6,
          },
        }}
        onBeforeEditorMount={ensurePhlareQL}
        onEditorDidMount={(editor, monaco) => {
          setupAutocompleteFn(editor, monaco);

          const updateElementHeight = () => {
            const containerDiv = containerRef.current;
            if (containerDiv !== null) {
              const pixelHeight = editor.getContentHeight();
              containerDiv.style.height = `${pixelHeight + EDITOR_HEIGHT_OFFSET}px`;
              containerDiv.style.width = '100%';
              const pixelWidth = containerDiv.clientWidth;
              editor.layout({ width: pixelWidth, height: pixelHeight });
            }
          };

          editor.onDidContentSizeChange(updateElementHeight);
          updateElementHeight();

          editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
            onRunQueryRef.current(editor.getValue());
          });
        }}
      />
    </div>
  );
}

// this number was chosen by testing various values. it might be necessary
// because of the width of the border, not sure.
//it needs to do 2 things:
// 1. when the editor is single-line, it should make the editor height be visually correct
// 2. when the editor is multi-line, the editor should not be "scrollable" (meaning,
//    you do a scroll-movement in the editor, and it will scroll the content by a couple pixels
//    up & down. this we want to avoid)
const EDITOR_HEIGHT_OFFSET = 2;

/**
 * Hook that returns function that will set up monaco autocomplete for the label selector
 */
function useAutocomplete(series?: SeriesMessage) {
  const providerRef = useRef<CompletionProvider>(new CompletionProvider());

  useEffect(() => {
    if (series) {
      // When we have the value we will pass it to the CompletionProvider
      providerRef.current.setSeries(series);
    }
  }, [series]);

  const autocompleteDisposeFun = useRef<(() => void) | null>(null);
  useEffect(() => {
    // when we unmount, we unregister the autocomplete-function, if it was registered
    return () => {
      autocompleteDisposeFun.current?.();
    };
  }, []);

  // This should be run in monaco onEditorDidMount
  return (editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    providerRef.current.editor = editor;
    providerRef.current.monaco = monaco;

    const { dispose } = monaco.languages.registerCompletionItemProvider(langId, providerRef.current);
    autocompleteDisposeFun.current = dispose;
  };
}

// we must only run the setup code once
let phlareqlSetupDone = false;
const langId = 'phlareql';

function ensurePhlareQL(monaco: Monaco) {
  if (phlareqlSetupDone === false) {
    phlareqlSetupDone = true;
    const { aliases, extensions, mimetypes, def } = languageDefinition;
    monaco.languages.register({ id: langId, aliases, extensions, mimetypes });
    monaco.languages.setMonarchTokensProvider(langId, def.language as languages.IMonarchLanguage);
    monaco.languages.setLanguageConfiguration(langId, def.languageConfiguration as languages.LanguageConfiguration);
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    queryField: css`
      flex: 1;
      // Not exactly sure but without this the editor doe not shrink after resizing (so you can make it bigger but not
      // smaller). At the same time this does not actually make the editor 100px because it has flex 1 so I assume
      // this should sort of act as a flex-basis (but flex-basis does not work for this). So yeah CSS magic.
      width: 100px;
    `,
    wrapper: css`
      display: flex;
      flex: 1;
      border: 1px solid rgba(36, 41, 46, 0.3);
      border-radius: 2px;
    `,
  };
};
