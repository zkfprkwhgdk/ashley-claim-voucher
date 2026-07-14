import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";

const ADMIN_PASSWORD = "ashley1!";
const DEFAULT_NOTICE = `① 고객 애슐리멤버스 APP 다운로드/회원가입 여부 확인 필요
 * 舊애슐리 APP 회원 / 통합멤버쉽만 가입된 회원 : 회원 조회는 되나, 실제 식사권 지급 시스템(오브젠)상 등록되지 않아 식사권 지급 불가 → 고객 안내 필요

② 당일 안내 통해 가입한 회원은 시스템상 식사권 지급 시스템 등록 불가
 ▶ 익일 조회/등록하여 식사권 지급 품의, 익익일 고객 식사권 지급 완료
 * 고객 가입 날짜로부터 이틀 뒤가 실질적으로 가장 빠른 지급날짜

③ 가장 빠른 식사권 지급 날짜 : 담당자(안태혁>AIO실) 요청일로부터 하루 뒤 (당일 발송 불가)`;

export default function App() {
  const [view, setView] = useState("store");
  const [tab, setTab] = useState("request");
  const [requests, setRequests] = useState([]);
  const [notice, setNotice] = useState(DEFAULT_NOTICE);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [adminPwError, setAdminPwError] = useState(false);
  const [toast, setToast] = useState(null);
  const [memberPopup, setMemberPopup] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // 초기 로드 + 실시간 구독
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("requests").select("*").order("created_at", { ascending: false });
      if (data) setRequests(data);
      const { data: s } = await supabase.from("settings").select("*").eq("key", "notice").single();
      if (s?.value) setNotice(s.value);
      setLoaded(true);
    };
    load();

    // 실시간 구독 - requests 테이블 변경 감지
    const channel = supabase.channel("realtime-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => {
        // 변경 발생 시 전체 재조회 (가장 안정적)
        supabase.from("requests").select("*").order("created_at", { ascending: false }).then(({ data }) => {
          if (data) setRequests(data);
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        supabase.from("settings").select("*").eq("key", "notice").single().then(({ data }) => {
          if (data?.value) setNotice(data.value);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const addRequest = useCallback(async (entry) => {
    await supabase.from("requests").insert(entry);
  }, []);

  const updateRequest = useCallback(async (id, updates) => {
    await supabase.from("requests").update(updates).eq("id", id);
  }, []);

  const removeRequest = useCallback(async (id) => {
    await supabase.from("requests").delete().eq("id", id);
  }, []);

  const saveNotice = useCallback(async (text) => {
    setNotice(text);
    await supabase.from("settings").upsert({ key: "notice", value: text });
  }, []);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  if (!loaded) return <div style={S.loading}><div style={S.spinner}/><p style={{marginTop:12,color:"#999"}}>데이터 불러오는 중...</p></div>;

  return (
    <div style={S.root}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {toast && <div style={S.toast}>{toast}</div>}
      <header style={S.header}>
        <div style={S.logo}><span style={{fontSize:22}}>🍽️</span><span style={S.logoText}>Ashley Queens</span></div>
        <div style={S.navToggle}>
          <button style={{...S.navBtn,...(view==="store"?S.navBtnActive:{})}} onClick={()=>{setView("store");setAdminAuth(false);setAdminPw("");}}>매장</button>
          <button style={{...S.navBtn,...(view==="admin"?S.navBtnActive:{})}} onClick={()=>setView("admin")}>관리자</button>
        </div>
      </header>

      {view==="store" && (
        <div style={S.content}>
          <div style={S.tabBar}>
            <button style={{...S.tabBtn,...(tab==="request"?S.tabBtnActive:{})}} onClick={()=>setTab("request")}>식사권 신청</button>
            <button style={{...S.tabBtn,...(tab==="history"?S.tabBtnActive:{})}} onClick={()=>setTab("history")}>신청 내역</button>
          </div>
          {tab==="request" && <RequestForm addRequest={addRequest} showToast={showToast} onGoHistory={()=>setTab("history")} notice={notice}/>}
          {tab==="history" && <HistoryTable requests={requests} masked={true}/>}
        </div>
      )}

      {view==="admin" && !adminAuth && (
        <div style={S.adminLogin}>
          <div style={S.adminLoginCard}>
            <div style={{fontSize:44,marginBottom:12}}>🔒</div>
            <h2 style={{fontSize:17,fontWeight:700,marginBottom:20,color:"#333"}}>관리자 인증</h2>
            <input type="password" placeholder="비밀번호 입력" value={adminPw}
              onChange={e=>{setAdminPw(e.target.value);setAdminPwError(false);}}
              onKeyDown={e=>{if(e.key==="Enter"){adminPw===ADMIN_PASSWORD?setAdminAuth(true):setAdminPwError(true);}}}
              style={{...S.input,...(adminPwError?{borderColor:"#e74c3c"}:{})}}/>
            {adminPwError && <p style={{color:"#e74c3c",fontSize:13,marginTop:8}}>비밀번호가 올바르지 않습니다</p>}
            <button style={S.primaryBtn} onClick={()=>{adminPw===ADMIN_PASSWORD?setAdminAuth(true):setAdminPwError(true);}}>로그인</button>
          </div>
        </div>
      )}

      {view==="admin" && adminAuth && (
        <AdminView requests={requests} updateRequest={updateRequest} removeRequest={removeRequest} showToast={showToast}
          memberPopup={memberPopup} setMemberPopup={setMemberPopup} notice={notice} saveNotice={saveNotice}/>
      )}
    </div>
  );
}

/* ═══ RequestForm ═══ */
function RequestForm({ addRequest, showToast, onGoHistory, notice }) {
  const refs = {
    category:useRef(), categoryEtc:useRef(), store:useRef(),
    custName:useRef(), custPhone:useRef(), custMember:useRef(),
    detail:useRef(), qty:useRef(), requester:useRef(),
  };
  const [showEtc, setShowEtc] = useState(false);
  const [errors, setErrors] = useState({});
  const [successPopup, setSuccessPopup] = useState(false);
  const [hasReadNotice, setHasReadNotice] = useState(false);
  const [agreeNotice, setAgreeNotice] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const v = k => refs[k]?.current?.value?.trim()||"";

  const validate = () => {
    const errs={};
    const req=["category","store","custName","custPhone","custMember","detail","qty","requester"];
    if(v("category")==="기타") req.push("categoryEtc");
    req.forEach(k=>{if(!v(k)||(k==="qty"&&parseInt(v(k))<1)) errs[k]=true;});
    if(v("requester")&&!/\S+@\S+\.\S+/.test(v("requester"))) errs.requester=true;
    const ph=v("custPhone").replace(/-/g,"");
    if(ph&&!/^01[016789]\d{7,8}$/.test(ph)) errs.custPhone=true;
    setErrors(errs);
    if(!agreeNotice) setAgreeError(true);
    return Object.keys(errs).length===0 && agreeNotice;
  };

  const submit = async () => {
    if(submitting) return;
    if(!validate()){showToast("필수 항목을 모두 입력해주세요");return;}
    setSubmitting(true);
    const entry={
      id:Date.now().toString(),created_at:new Date().toISOString(),
      category:v("category"),category_etc:v("category")==="기타"?v("categoryEtc"):"",
      store:v("store"),
      cust_name:v("custName"),cust_phone:v("custPhone"),cust_member:v("custMember"),
      detail:v("detail"),qty:parseInt(v("qty"))||1,requester:v("requester"),
      status:"대기",approved_date:"",issued_date:"",reject_reason:"",member_note:"",
    };
    await addRequest(entry);
    Object.values(refs).forEach(r=>{if(r.current)r.current.value="";});
    if(refs.qty.current)refs.qty.current.value="1";
    if(refs.category.current)refs.category.current.value="";
    setShowEtc(false);setAgreeNotice(false);setHasReadNotice(false);setErrors({});
    setSubmitting(false);
    setSuccessPopup(true);
  };

  const closeNotice=()=>{setShowNotice(false);setHasReadNotice(true);};
  const eS=k=>errors[k]?S.inputError:{};

  return (
    <div style={S.formWrap}>
      <h2 style={S.formTitle}>모바일 식사권 발급 요청</h2>

      <div style={{...S.noticeBox,marginBottom:24,...(agreeError&&!agreeNotice?{borderColor:"#e74c3c",background:"#fff5f5"}:{})}}>
        <button style={S.noticeReadBtn} onClick={()=>setShowNotice(true)}>
          {hasReadNotice?"✅ 안내사항 읽기 완료 (다시 보기)":"📋 안내사항 읽기 (필수)"}
        </button>
        <label style={{...S.checkRow,opacity:hasReadNotice?1:0.4,pointerEvents:hasReadNotice?"auto":"none"}}>
          <input type="checkbox" checked={agreeNotice} onChange={e=>{setAgreeNotice(e.target.checked);if(e.target.checked)setAgreeError(false);}} style={S.checkbox}/>
          <span style={S.checkLabel}>식사권 발급 관련 안내사항을 읽었으며, 해당 내용 고객 안내되었습니다. <span style={S.req}>*</span></span>
        </label>
        {!hasReadNotice&&<p style={{fontSize:12,color:"#e65100",margin:"8px 0 0",paddingLeft:4}}>⚠️ 안내사항을 먼저 읽어주세요</p>}
        {agreeError&&!agreeNotice&&<p style={{fontSize:12,color:"#e74c3c",margin:"6px 0 0"}}>안내사항 확인 및 고객 안내 체크가 필요합니다</p>}
      </div>

      {showNotice&&(
        <div style={S.popupOverlay} onClick={closeNotice}>
          <div style={S.noticePopup} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:17,fontWeight:700,color:"#222",margin:"0 0 16px"}}>📋 식사권 발급 안내사항</h3>
            <div style={S.noticeContent}>
              {notice?notice.split("\n").map((l,i)=><p key={i} style={{fontSize:14,color:"#444",lineHeight:1.8,margin:0}}>{l||"\u00A0"}</p>)
                :<p style={{color:"#999",textAlign:"center",padding:"20px 0"}}>등록된 안내사항이 없습니다.</p>}
            </div>
            <button style={S.primaryBtn} onClick={closeNotice}>확인했습니다</button>
          </div>
        </div>
      )}

      <F label="구분" err={errors.category}>
        <select ref={refs.category} defaultValue="" style={{...S.input,...S.select,...eS("category")}} onChange={e=>setShowEtc(e.target.value==="기타")}>
          <option value="">선택하세요</option><option value="마케팅용">마케팅용</option><option value="클레임용">클레임용</option><option value="기타">기타</option>
        </select>
      </F>
      {showEtc&&<F label="기타 내용" err={errors.categoryEtc}><input ref={refs.categoryEtc} defaultValue="" placeholder="기타 구분 내용" style={{...S.input,...eS("categoryEtc")}}/></F>}
      <F label="요청매장" err={errors.store}><input ref={refs.store} defaultValue="" style={{...S.input,...eS("store")}}/></F>
      <F label="고객 성명" err={errors.custName}><input ref={refs.custName} defaultValue="" style={{...S.input,...eS("custName")}}/></F>
      <F label="고객 핸드폰 번호" err={errors.custPhone}><input ref={refs.custPhone} defaultValue="" placeholder="010-0000-0000" inputMode="tel" style={{...S.input,...eS("custPhone")}}/></F>
      <F label="고객 회원번호" err={errors.custMember}>
        <input ref={refs.custMember} defaultValue="" placeholder="회원번호 입력" style={{...S.input,...eS("custMember")}}/>
        <p style={{fontSize:12,color:"#888",margin:"5px 0 0 2px"}}>※ BO에서 검색하여 입력해주세요</p>
      </F>
      <F label="세부내용 (클레임 내용)" err={errors.detail}><textarea ref={refs.detail} defaultValue="" rows={4} style={{...S.input,...S.textarea,...eS("detail")}}/></F>
      <F label="요청 식사권 장수" err={errors.qty}><input ref={refs.qty} type="number" min={1} defaultValue="1" inputMode="numeric" style={{...S.input,...eS("qty"),width:120}}/></F>
      <div style={{background:"#f9f0ff",border:"1px solid #e1bee7",borderRadius:10,padding:"12px 14px",marginTop:-8,marginBottom:16}}>
        <p style={{fontSize:13,color:"#555",margin:0,lineHeight:1.6}}>식사권 : 성인 주말 식사권<br/>유효기간 : 3달</p>
      </div>
      <F label="발급 요청인 (이메일)" err={errors.requester}><input ref={refs.requester} type="email" defaultValue="" placeholder="example@email.com" inputMode="email" style={{...S.input,...eS("requester")}}/></F>

      <button style={{...S.submitBtn,...(submitting?{opacity:0.6}:{})}} onClick={submit} disabled={submitting}>
        {submitting?"요청 중...":"발급 요청하기"}
      </button>

      {successPopup&&(
        <div style={S.popupOverlay} onClick={()=>setSuccessPopup(false)}>
          <div style={S.successPopup} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:48,marginBottom:8}}>✅</div>
            <h3 style={{fontSize:17,fontWeight:700,color:"#222",margin:"0 0 8px"}}>식사권 발급이 요청되었습니다</h3>
            <p style={{fontSize:14,color:"#888",lineHeight:1.6,margin:0}}>신청 내역 탭에서 진행 상황을 확인하실 수 있습니다.</p>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button style={S.secondaryBtn} onClick={()=>setSuccessPopup(false)}>닫기</button>
              <button style={S.primaryBtn} onClick={()=>{setSuccessPopup(false);onGoHistory();}}>신청 내역 확인 →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function F({label,err,children}){
  return(<div style={S.field}><label style={S.label}>{label} <span style={S.req}>*</span></label>{children}{err&&<span style={S.errorSmall}>필수 입력 항목입니다</span>}</div>);
}

/* ═══ Masking ═══ */
const maskName=n=>!n?"":n.length<=1?"*":n.length===2?n[0]+"*":n[0]+"*".repeat(n.length-2)+n[n.length-1];
const maskPhone=p=>{if(!p)return"";const c=p.replace(/-/g,"");if(c.length<8)return p;return`${c.slice(0,3)}-${c.slice(3,5)}**-**${c.slice(-2)}`;};

const STATUS_STYLE={
  "대기":{background:"#fff3e0",color:"#e65100"},
  "승인완료":{background:"#e3f2fd",color:"#1565c0"},
  "발급처리":{background:"#e8f5e9",color:"#2e7d32"},
  "승인거절":{background:"#ffebee",color:"#c62828"},
};

/* ═══ HistoryTable ═══ */
function HistoryTable({requests,masked,onApprove,onReject,onIssue,onDelete,memberPopup,setMemberPopup,updateRequest}){
  const [search,setSearch]=useState("");
  const [rejectInputId,setRejectInputId]=useState(null);
  const [rejectReason,setRejectReason]=useState("");
  const [deleteConfirmId,setDeleteConfirmId]=useState(null);

  const filtered=requests.filter(r=>{
    if(!search)return true;
    const s=search.toLowerCase();
    return[r.store,r.cust_name,r.requester,r.category,r.status].some(x=>x?.toLowerCase().includes(s));
  });

  return(
    <div style={S.historyWrap}>
      <div style={S.searchRow}>
        <input style={{...S.input,flex:1}} placeholder="🔍 매장명, 이름, 이메일 검색..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <span style={S.countBadge}>{filtered.length}건</span>
      </div>
      {filtered.length===0&&<div style={S.emptyState}><div style={{fontSize:48,marginBottom:12}}>📋</div><p style={{color:"#999"}}>신청 내역이 없습니다</p></div>}

      {filtered.map((r,i)=>(
        <div key={r.id||i} style={S.card}>
          <div style={S.cardHeader}>
            <span style={{...S.statusBadge,...(STATUS_STYLE[r.status]||STATUS_STYLE["대기"])}}>{r.status}</span>
            <span style={{fontSize:12,color:"#999"}}>{r.created_at?new Date(r.created_at).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):""}</span>
          </div>

          {(()=>{
            const s=r.status;const isR=s==="승인거절";
            const step2=["승인완료","발급처리","승인거절"].includes(s);const step3=s==="발급처리";
            const dc="#7b1fa2",rc="#c62828",gy="#ddd",lg="#eee";
            const dOn={width:12,height:12,borderRadius:"50%",background:isR&&!step3?rc:dc};
            const dOff={width:10,height:10,borderRadius:"50%",background:gy};
            const lOn={flex:1,height:3,background:isR?rc:dc,margin:"0 2px",marginBottom:18};
            const lOff={flex:1,height:3,background:lg,margin:"0 2px",marginBottom:18};
            const tOn={fontSize:10,color:isR&&!step3?"#c62828":"#7b1fa2",fontWeight:700,whiteSpace:"nowrap"};
            const tOff={fontSize:10,color:"#bbb",fontWeight:600,whiteSpace:"nowrap"};
            return(<div style={{margin:"10px 0 14px",padding:"0 8px"}}><div style={{display:"flex",alignItems:"center"}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={dOn}/><span style={tOn}>대기</span></div>
              <div style={step2?lOn:lOff}/>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={step2?dOn:dOff}/><span style={step2?tOn:tOff}>{isR?"거절":"승인"}</span></div>
              <div style={step3?lOn:lOff}/>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={step3?dOn:dOff}/><span style={step3?tOn:tOff}>발급</span></div>
            </div></div>);
          })()}

          <div>
            <Row label="구분" value={r.category==="기타"?`기타: ${r.category_etc}`:r.category}/>
            <Row label="매장" value={r.store}/>
            <Row label="고객" value={masked?`${maskName(r.cust_name)} / ${maskPhone(r.cust_phone)}`:`${r.cust_name} / ${r.cust_phone}`}/>
            {!masked&&r.cust_member&&<Row label="회원번호" value={r.cust_member}/>}
            <Row label="세부내용" value={r.detail}/>
            <Row label="장수" value={`${r.qty}장`}/>
            <Row label="요청인" value={r.requester}/>
            {r.approved_date&&<Row label="승인일" value={r.approved_date}/>}
            {r.issued_date&&<Row label="발급(승인)일" value={r.issued_date}/>}
            {r.issued_date&&(()=>{const d=new Date(r.issued_date);d.setDate(d.getDate()+1);return<Row label="발급 예정일" value={d.toISOString().slice(0,10)}/>;})()}
            {r.reject_reason&&<Row label="거절사유" value={r.reject_reason}/>}
          </div>

          {!masked&&r.cust_member&&setMemberPopup&&(
            <div style={{marginTop:8}}>
              <button style={S.memberBtn} onClick={()=>setMemberPopup(memberPopup?.idx===i?null:{idx:i,note:r.member_note||""})}>
                {r.member_note?"📝 회원 메모 보기/수정":"📝 회원 메모 작성"}
              </button>
              {memberPopup?.idx===i&&(
                <div style={S.popupOverlay} onClick={()=>setMemberPopup(null)}>
                  <div style={S.popup} onClick={e=>e.stopPropagation()}>
                    <h3 style={{fontSize:16,fontWeight:700,marginTop:0,marginBottom:8}}>회원 메모 (관리자 전용)</h3>
                    <p style={{fontSize:13,color:"#888",marginBottom:8}}>회원번호: {r.cust_member}</p>
                    <textarea style={{...S.input,...S.textarea}} value={memberPopup.note} onChange={e=>setMemberPopup({...memberPopup,note:e.target.value})} rows={4} placeholder="메모 입력..."/>
                    <div style={{display:"flex",gap:8,marginTop:12}}>
                      <button style={S.secondaryBtn} onClick={()=>setMemberPopup(null)}>취소</button>
                      <button style={S.primaryBtn} onClick={()=>{updateRequest(r.id,{member_note:memberPopup.note});setMemberPopup(null);}}>저장</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {onApprove&&r.status==="대기"&&(
            <div style={S.adminActions}>
              {rejectInputId===r.id?(
                <div>
                  <label style={{fontSize:13,color:"#c62828",fontWeight:600}}>거절 사유</label>
                  <textarea style={{...S.input,...S.textarea,marginTop:6,minHeight:60}} placeholder="승인 거절 사유를 입력해주세요" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} rows={2}/>
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button style={S.rejectBtn} onClick={()=>{if(!rejectReason.trim())return;onReject(r.id,rejectReason.trim());setRejectInputId(null);setRejectReason("");}}>거절 확인</button>
                    <button style={S.cancelBtn} onClick={()=>{setRejectInputId(null);setRejectReason("");}}>취소</button>
                  </div>
                </div>
              ):(
                <div style={{display:"flex",gap:8}}>
                  <button style={S.approveBtn} onClick={()=>onApprove(r.id)}>✅ 승인</button>
                  <button style={S.rejectBtn} onClick={()=>{setRejectInputId(r.id);setRejectReason("");}}>❌ 승인 거절</button>
                </div>
              )}
            </div>
          )}

          {onIssue&&r.status==="승인완료"&&(
            <div style={S.adminActions}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <label style={{fontSize:13,color:"#666"}}>발급(승인)일:</label>
                <input type="date" style={{...S.input,width:"auto",flex:1,minWidth:140}} defaultValue={new Date().toISOString().slice(0,10)} id={`date-${r.id}`}/>
              </div>
              <button style={{...S.issueBtn,marginTop:10,width:"100%"}} onClick={()=>{
                const d=document.getElementById(`date-${r.id}`);
                onIssue(r.id,d?.value||new Date().toISOString().slice(0,10));
              }}>📤 발급 처리</button>
            </div>
          )}

          {onDelete&&r.status==="발급처리"&&(
            <div style={S.adminActions}>
              {deleteConfirmId===r.id?(
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:13,color:"#c62828",fontWeight:600}}>정말 삭제하시겠습니까?</span>
                  <button style={S.deleteConfirmBtn} onClick={()=>{onDelete(r.id);setDeleteConfirmId(null);}}>삭제</button>
                  <button style={S.cancelBtn} onClick={()=>setDeleteConfirmId(null)}>취소</button>
                </div>
              ):(
                <button style={S.deleteBtn} onClick={()=>setDeleteConfirmId(r.id)}>🗑️ 삭제</button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Row({label,value}){return<div style={S.row}><span style={S.rowLabel}>{label}</span><span style={S.rowValue}>{value}</span></div>;}

/* ═══ AdminView ═══ */
function AdminView({requests,updateRequest,removeRequest,showToast,memberPopup,setMemberPopup,notice,saveNotice}){
  const [editingNotice,setEditingNotice]=useState(false);
  const [noticeText,setNoticeText]=useState(notice);

  const handleApprove=async id=>{await updateRequest(id,{status:"승인완료",approved_date:new Date().toISOString().slice(0,10)});showToast("✅ 승인 완료");};
  const handleReject=async(id,reason)=>{await updateRequest(id,{status:"승인거절",reject_reason:reason});showToast("❌ 승인 거절 처리 완료");};
  const handleIssue=async(id,d)=>{await updateRequest(id,{status:"발급처리",issued_date:d});showToast("📤 발급 처리 완료");};
  const handleDelete=async id=>{await removeRequest(id);showToast("🗑️ 삭제 완료");};

  const downloadCSV=()=>{
    const h=["구분","기타내용","매장","신청일시","고객명","연락처","회원번호","세부내용","장수","요청인","상태","승인일","발급(승인)일","발급예정일","거절사유","회원메모"];
    const rows=requests.map(r=>{
      let estDate="";
      if(r.issued_date){const d=new Date(r.issued_date);d.setDate(d.getDate()+1);estDate=d.toISOString().slice(0,10);}
      const reqTime=r.created_at?new Date(r.created_at).toLocaleString("ko-KR"):"";
      return[r.category,r.category_etc||"",r.store,reqTime,r.cust_name,r.cust_phone,r.cust_member||"",r.detail,r.qty,r.requester,r.status,r.approved_date||"",r.issued_date||"",estDate,r.reject_reason||"",r.member_note||""];
    });
    const csv="\uFEFF"+[h,...rows].map(row=>row.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=`식사권_발급내역_${new Date().toISOString().slice(0,10)}.csv`;a.click();
    showToast("📥 CSV 다운로드 완료");
  };

  const st={total:requests.length,pending:requests.filter(r=>r.status==="대기").length,approved:requests.filter(r=>r.status==="승인완료").length,issued:requests.filter(r=>r.status==="발급처리").length,rejected:requests.filter(r=>r.status==="승인거절").length};

  return(
    <div style={S.content}>
      <div style={S.adminHeader}>
        <h2 style={{fontSize:18,fontWeight:700,color:"#222",margin:0}}>관리자 페이지</h2>
        <button style={S.downloadBtn} onClick={downloadCSV}>📥 CSV</button>
      </div>
      <div style={S.statsRow}>
        <div style={{...S.statCard,borderLeft:"4px solid #7b1fa2"}}><div style={S.statNum}>{st.total}</div><div style={S.statLabel}>전체</div></div>
        <div style={{...S.statCard,borderLeft:"4px solid #e65100"}}><div style={S.statNum}>{st.pending}</div><div style={S.statLabel}>대기</div></div>
        <div style={{...S.statCard,borderLeft:"4px solid #1565c0"}}><div style={S.statNum}>{st.approved}</div><div style={S.statLabel}>승인</div></div>
        <div style={{...S.statCard,borderLeft:"4px solid #2e7d32"}}><div style={S.statNum}>{st.issued}</div><div style={S.statLabel}>발급</div></div>
        <div style={{...S.statCard,borderLeft:"4px solid #c62828"}}><div style={S.statNum}>{st.rejected}</div><div style={S.statLabel}>거절</div></div>
      </div>

      <div style={S.noticeEditor}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h3 style={{fontSize:15,fontWeight:700,color:"#333",margin:0}}>📋 안내사항 관리</h3>
          {!editingNotice?(<button style={S.noticeEditBtn} onClick={()=>{setNoticeText(notice);setEditingNotice(true);}}>수정</button>
          ):(<div style={{display:"flex",gap:6}}>
            <button style={S.cancelBtn} onClick={()=>setEditingNotice(false)}>취소</button>
            <button style={S.noticeSaveBtn} onClick={async()=>{await saveNotice(noticeText);setEditingNotice(false);showToast("✅ 안내사항 저장 완료");}}>저장</button>
          </div>)}
        </div>
        {editingNotice?(<textarea style={{...S.input,...S.textarea,minHeight:120}} value={noticeText} onChange={e=>setNoticeText(e.target.value)} placeholder="안내사항을 입력해주세요..."/>
        ):(<div style={S.noticePreview}>
          {notice?notice.split("\n").map((l,i)=><p key={i} style={{fontSize:13,color:"#444",lineHeight:1.7,margin:0}}>{l||"\u00A0"}</p>)
            :<p style={{color:"#999",fontSize:13}}>등록된 안내사항이 없습니다.</p>}
        </div>)}
      </div>

      <HistoryTable requests={requests} masked={false} onApprove={handleApprove} onReject={handleReject} onIssue={handleIssue} onDelete={handleDelete}
        memberPopup={memberPopup} setMemberPopup={setMemberPopup} updateRequest={updateRequest}/>
    </div>
  );
}

/* ═══ Styles ═══ */
const S={
  root:{fontFamily:"'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#f5f5f7",minHeight:"100vh",maxWidth:480,margin:"0 auto",position:"relative",WebkitTextSizeAdjust:"100%"},
  loading:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh"},
  spinner:{width:32,height:32,border:"3px solid #eee",borderTop:"3px solid #7b1fa2",borderRadius:"50%",animation:"spin 0.8s linear infinite"},
  toast:{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:"#333",color:"#fff",padding:"10px 20px",borderRadius:10,fontSize:13,zIndex:9999,boxShadow:"0 4px 16px rgba(0,0,0,0.2)",maxWidth:"90vw",textAlign:"center"},
  header:{background:"linear-gradient(135deg,#7b1fa2,#9c27b0)",padding:"14px 16px 10px",position:"sticky",top:0,zIndex:100},
  logo:{display:"flex",alignItems:"center",gap:8,marginBottom:10},
  logoText:{fontSize:18,fontWeight:700,color:"#fff",letterSpacing:-0.5},
  navToggle:{display:"flex",background:"rgba(255,255,255,0.15)",borderRadius:10,padding:3},
  navBtn:{flex:1,padding:"8px 0",border:"none",background:"transparent",color:"rgba(255,255,255,0.7)",fontSize:14,fontWeight:600,borderRadius:8,cursor:"pointer"},
  navBtnActive:{background:"#fff",color:"#7b1fa2"},
  content:{padding:"0 0 32px"},
  tabBar:{display:"flex",padding:"10px 14px 0",gap:4},
  tabBtn:{flex:1,padding:"11px 0",border:"none",background:"transparent",color:"#999",fontSize:14,fontWeight:600,borderBottom:"3px solid transparent",cursor:"pointer"},
  tabBtnActive:{color:"#7b1fa2",borderBottomColor:"#7b1fa2"},
  formWrap:{padding:"16px 14px"},
  formTitle:{fontSize:17,fontWeight:700,color:"#222",marginBottom:16,marginTop:0},
  field:{marginBottom:16},
  label:{display:"block",fontSize:13,fontWeight:600,color:"#444",marginBottom:5},
  req:{color:"#e74c3c",fontSize:11},
  input:{width:"100%",padding:"11px 12px",border:"1.5px solid #ddd",borderRadius:10,fontSize:16,background:"#fff",outline:"none",boxSizing:"border-box",WebkitAppearance:"none"},
  inputError:{borderColor:"#e74c3c",background:"#fff5f5"},
  select:{appearance:"none",cursor:"pointer"},
  textarea:{resize:"vertical",minHeight:80,lineHeight:1.5},
  errorSmall:{display:"block",fontSize:11,color:"#e74c3c",marginTop:3},
  submitBtn:{width:"100%",padding:"15px",background:"linear-gradient(135deg,#7b1fa2,#9c27b0)",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:"pointer",marginTop:8,WebkitTapHighlightColor:"transparent"},
  historyWrap:{padding:"14px"},
  searchRow:{display:"flex",gap:8,marginBottom:14,alignItems:"center"},
  countBadge:{background:"#7b1fa2",color:"#fff",padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:600,whiteSpace:"nowrap"},
  emptyState:{textAlign:"center",padding:"50px 16px"},
  card:{background:"#fff",borderRadius:14,padding:14,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  cardHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4},
  statusBadge:{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700},
  row:{display:"flex",padding:"5px 0",borderBottom:"1px solid #f5f5f5",gap:6},
  rowLabel:{fontSize:12,color:"#999",minWidth:62,flexShrink:0,fontWeight:500},
  rowValue:{fontSize:13,color:"#333",flex:1,wordBreak:"break-word"},
  adminLogin:{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"calc(100vh - 90px)",padding:16},
  adminLoginCard:{background:"#fff",borderRadius:20,padding:"36px 24px",textAlign:"center",width:"100%",maxWidth:320,boxShadow:"0 4px 20px rgba(0,0,0,0.08)"},
  primaryBtn:{width:"100%",padding:"13px",background:"#7b1fa2",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:600,cursor:"pointer",marginTop:10},
  secondaryBtn:{flex:1,padding:"10px",background:"#f5f5f5",color:"#666",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer"},
  adminHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 14px 6px"},
  downloadBtn:{padding:"7px 14px",background:"#fff",border:"1.5px solid #ddd",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",color:"#333"},
  statsRow:{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,padding:"10px 14px"},
  statCard:{background:"#fff",borderRadius:10,padding:"10px 4px",textAlign:"center"},
  statNum:{fontSize:20,fontWeight:800,color:"#333"},
  statLabel:{fontSize:10,color:"#999",marginTop:2},
  adminActions:{marginTop:12,paddingTop:12,borderTop:"1px dashed #eee"},
  approveBtn:{flex:1,padding:"11px 16px",background:"#1565c0",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer"},
  issueBtn:{padding:"11px 16px",background:"#2e7d32",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer"},
  rejectBtn:{flex:1,padding:"11px 16px",background:"#ffebee",color:"#c62828",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer"},
  cancelBtn:{padding:"8px 14px",background:"#f5f5f5",color:"#666",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"},
  deleteBtn:{width:"100%",padding:"10px",background:"#fff",color:"#c62828",border:"1.5px solid #ffcdd2",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer"},
  deleteConfirmBtn:{padding:"8px 14px",background:"#c62828",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"},
  memberBtn:{padding:"8px 12px",background:"#f9f0ff",color:"#7b1fa2",border:"1px solid #e1bee7",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"},
  popupOverlay:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  popup:{background:"#fff",borderRadius:16,padding:20,width:"100%",maxWidth:340},
  successPopup:{background:"#fff",borderRadius:20,padding:"32px 24px",width:"100%",maxWidth:320,textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.15)"},
  noticeBox:{background:"#fafafa",border:"1.5px solid #e0e0e0",borderRadius:12,padding:"14px 14px"},
  checkRow:{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",marginTop:12},
  checkbox:{width:20,height:20,marginTop:1,accentColor:"#7b1fa2",flexShrink:0,cursor:"pointer"},
  checkLabel:{fontSize:13,color:"#333",lineHeight:1.5},
  noticeReadBtn:{display:"block",width:"100%",padding:"12px 14px",background:"#7b1fa2",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",textAlign:"center"},
  noticePopup:{background:"#fff",borderRadius:20,padding:"24px 20px",width:"100%",maxWidth:360,maxHeight:"80vh",display:"flex",flexDirection:"column"},
  noticeContent:{flex:1,overflowY:"auto",padding:14,background:"#fafafa",borderRadius:10,marginBottom:14,maxHeight:"55vh"},
  noticeEditor:{margin:"10px 14px",background:"#fff",borderRadius:14,padding:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  noticeEditBtn:{padding:"6px 12px",background:"#f9f0ff",color:"#7b1fa2",border:"1px solid #e1bee7",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"},
  noticeSaveBtn:{padding:"6px 12px",background:"#7b1fa2",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"},
  noticePreview:{padding:"10px 12px",background:"#fafafa",borderRadius:10,minHeight:40},
};
