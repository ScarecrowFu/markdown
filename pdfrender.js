/* eslint-disable */
import React, { useState, useEffect } from 'react'
import { message} from 'antd'
import PropTypes from 'prop-types'
import debounce from 'lodash.debounce'
import { transform } from 'buble'
import styled from '@react-pdf/styled-components'
import { pdf } from '@react-pdf/renderer'
import { Page, Text, Link, Font, View, Canvas, Note, Image, StyleSheet } from '@react-pdf/renderer'
import RenderDocument from 'react-pdf/dist/Document'
import RenderPage from 'react-pdf/dist/Page'
import { saveAs } from 'file-saver'
// eslint-disable-next-line
import pdfjs from 'pdfjs-dist/webpack'

import { Drawer, Button, Pagination } from 'antd'
import 'antd/dist/antd.css'

import { UnControlled as CodeMirror } from 'react-codemirror2'


// 编译PDF，并语法检查
const Document = 'DOCUMENT'

const primitives = { Document, Page, Text, Link, Font, View, Note, Image, Canvas, StyleSheet, styled }

const transpile = (code, callback, onError) => {
  try {
    const result = transform(code, {
      objectAssign: 'Object.assign',
      transforms: {
        dangerousForOf: true,
        dangerousTaggedTemplateString: true,
        moduleImport: false,
      }
    })

    // eslint-disable-next-line
    const res = new Function('React', 'ReactPDF', ...Object.keys(primitives), result.code)

    res(React, { render: doc => callback(doc) }, ...Object.values(primitives))

  } catch (e) {
    if (onError) {
      onError(e)
    }
  }
}

// 代码抽屉
const CodeDrawer = (props) => {
  const [visible, setVisible] = useState(false)

  const showDrawer = () => {
    setVisible(true)
  }

  const onClose = () => {
    setVisible(false)
  }

  return (
    <>
      {
        props.isCodeAndDataShow&&<Button type="primary" onClick={showDrawer}>
          {props.name}
        </Button>
      }

      <Drawer
        title={props.name}
        placement={props.direction}
        closable={true}
        onClose={onClose}
        visible={visible}
        maskClosable={false}
        width={"35vw"}
        mask={false}
      >
        <CodeMirror
          value={props.value}
          className='code'
          options={props.options}
          onChange={props.onChange}
        />
        <div className='error'>{props.error}</div>
      </Drawer>
    </>
  )
}

// 去抖动
const debounceTransplie = debounce(transpile, 300)


// PDF在线渲染组件
function PDFRenderPanel(props) {
  const [code, setCode] = useState(null)
  const [data, setData] = useState(null)
  const [element, setElement] = useState(null)
  const [document, setDocument] = useState(null)
  const [error, setError] = useState(null)
  const [loadings, setLoadings] = useState([])
  const [numPages, setNumPages] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCode(props.code)
    setData(props.data)
    sessionStorage.setItem('pdfCode', props.code)
  }, [props.code, props.data])

  useEffect(() => {
    setError(null)
    transpile(`const report = ${data}\n\n${code}`)
  }, [code, data])

  const transpile = doc => {
    debounceTransplie(
      doc,
      element => setElement(element),
      error => setError("编译错误：" + error.message)
    )
  }

  const renderDocument = doc => {
    if (!doc) {
      setNumPages(null)
      setCurrentPage(1)
    }

    try {
      pdf(doc)
        .toBlob()
        .then(blob => {
          const url = URL.createObjectURL(blob)
          setDocument(url)
          setLoadings(prevLoadings => {
            const newLoadings = [...prevLoadings]
            newLoadings[0] = false
            return newLoadings
          })
        }, err => setError(err))
    } catch (err) {
      setError(err)
    }
  }
  const generatePDF = async (doc, filename) => {
    const blob = await pdf(doc).toBlob();
    saveAs(blob, filename)
    setLoadings(prevLoadings => {
      const newLoadings = [...prevLoadings]
      newLoadings[1] = false
      return newLoadings
    })
  }

  const enterLoading = index => {
    if (element === null || element === undefined) {
      message.warning('报告模板代码无效');
      return;
    }
    setLoadings(prevLoadings => {
      const newLoadings = [...prevLoadings]
      newLoadings[index] = true
      return newLoadings
    })

    if (index === 0) {
      renderDocument(element)
    }

    if (index === 1) {
      generatePDF(element, props.currentSerialNumber)
    }
  }

  const onDocumentLoad = ({ numPages }) => {
    setNumPages(numPages)
    setCurrentPage(Math.min(currentPage, numPages))
  }

  const onJumpPage = page => {
    setCurrentPage(page)
  }

  const handleChangeCode = (v) => {
    setCode(v)
    sessionStorage.setItem('pdfCode', v)
  }

  return (
    <div className='renderWrapper'>
      <div className='flexWrap alignItems spaceAround'>
        <CodeDrawer
          name="代码"
          value={props.code}
          isCodeAndDataShow={props.isCodeAndDataShow}
          options={{
            lineNumbers: true,
            mode: { name: "jsx" },
            theme: "monokai",
            extraKeys: { "Ctrl": "autocomplete", "Ctrl-K": function (cm) { cm.foldCode(cm.getCursor()) } },
            autofocus: true,
            styleActiveLine: true,
            lineWrapping: true,
            foldGutter: true,
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter', 'CodeMirror-lint-markers'],
            autoCloseBrackets: true,
            highlightSelectionMatches: true,
            matchTags: { bothTags: true }
          }}
          direction="left"
          onChange={(editor, data, value) => handleChangeCode(value)}
          error={error}
        />
        <Button type="primary" loading={loadings[0]} onClick={() => enterLoading(0)}>
          渲染
        </Button>
        <Button type="primary" loading={loadings[1]} onClick={() => enterLoading(1)}>
          下载
        </Button>
        <CodeDrawer
          name="数据"
          value={props.data}
          isCodeAndDataShow={props.isCodeAndDataShow}
          options={{
            lineNumbers: true,
            mode: { name: "javascript" },
            theme: "monokai"
          }}
          direction="right"
          onChange={(editor, data, value) => setData(value)}
        />
      </div>
      <div className='page flexWrap alignItems justifyContentCenter'>
        <RenderDocument
          className={document && "pdf"}
          loading={"准备PDF中..."}
          noData={"代码、数据准备完毕，请点击渲染按钮查看PDF"}
          file={document}
          onLoadSuccess={onDocumentLoad}
        >
          <RenderPage height={800} renderMode="svg" pageNumber={currentPage}></RenderPage>
        </RenderDocument>
      </div>
      <div className='flexWrap alignItems justifyContentCenter'>
        {numPages >= 1 && <Pagination defaultCurrent={currentPage} defaultPageSize={1} total={numPages} onChange={onJumpPage} />}
      </div>
    </div>
  )
}

/**
 * @prop code 代码文本
 * @prop data 数据文本
 * @prop name PDF文件名
 */
PDFRenderPanel.propTypes = {
  code: PropTypes.string.isRequired,
  data: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
}

export default PDFRenderPanel
