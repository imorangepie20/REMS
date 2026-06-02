# 네이버 매물 데이터 스크래핑 프로젝트

## 프로젝트 개요

    부동산 관련 컨텐츠를 네이버에서 수집하고 이를 표로 정리하여 보여주며, 여러가지 방식으로 데이터를 다운로드 및 시각화가 가능한 프로젝트

## 프로젝트 구조
    
    부동산 관련 컨텐츠를 네이버에서 수집하는 부분과 수집된 데이터를 분석하여 표로 보여주고 다운로드 및 시각화하는 부분으로 나뉜다.

    ### 데이터 수집

        1. 지역 선택(동단위 까지) - 매매 타입 선택 - 매물 유형 선택 후 데이터 추출
            - 카카오 지도에 해당 매물의 위치와 정보가 표시된다.
            - 아파트의 경우에는 단지 정보가 먼저 표시 되고 이어 아파트의 매물 정보가 표시된다.
            - 아파트 이외의 경우에는 매물 정보가 바로 표시된다.
        2. 네이버 부동산에는 다양한 데이터가 존재하지만 가장 기본적인 데이터만울 추출하여 저장한다.

    ### 데이터 출력
        1. 테이블 셀 형식으로 출력하고 다양한 검색과 필터링으로 데이터를 조회할 수 있다.
        2. 필드 필터링등을 통해 원하는 형식의 엑셀파일로 다운로드 받을 수 있게 한다.
    
    ### API 샘플
    경기도 > 수원시 장안구 > 정자동 - 매매 - 아파트
    아파트 단지 정보
    https://fin.land.naver.com/map?tradeTypes=A1&realEstateTypes=A01&hasArticleComplex=true&center=3zho3q-2AzU22&zoom=15.783523772917425&showOnlySelectedRegion=true
    fetch("https://fin.land.naver.com/front-api/v1/complex/region?eupLegalDivisionNumber=4111113000&size=30&sortType=HOUSEHOLD&page=0", {
        "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
        "baggage": "sentry-environment=real,sentry-release=property-web%402026.05.28,sentry-public_key=ec5063b7741b4a9282a85c1e2f27ab09,sentry-trace_id=ba928e4afc664df5a37a39ea163cb910",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Chromium\";v=\"148\", \"Google Chrome\";v=\"148\", \"Not/A)Brand\";v=\"99\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sentry-trace": "ba928e4afc664df5a37a39ea163cb910-9820316938ed454c"
    },
    "referrer": "https://fin.land.naver.com/map?tradeTypes=A1&realEstateTypes=A01&hasArticleComplex=true&center=3zho3q-2AzU22&zoom=15.783523772917425&showOnlySelectedRegion=true",
    "body": null,
    "method": "GET",
    "mode": "cors",
    "credentials": "include"
    });

    해당 단지 아파트 매물 정보 간단 리스트
    fetch("https://fin.land.naver.com/front-api/v1/complex/article/list", {
    "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
        "baggage": "sentry-environment=real,sentry-release=property-web%402026.05.28,sentry-public_key=ec5063b7741b4a9282a85c1e2f27ab09,sentry-trace_id=2a724895c8c542d5a53bccad91d4cdcf",
        "content-type": "application/json",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Chromium\";v=\"148\", \"Google Chrome\";v=\"148\", \"Not/A)Brand\";v=\"99\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sentry-trace": "2a724895c8c542d5a53bccad91d4cdcf-865ae998e276885b"
    },
    "referrer": "https://fin.land.naver.com/map?tradeTypes=A1&realEstateTypes=A01&hasArticleComplex=true&center=3zi7hH-2AB0Tv&zoom=15.302796058355357&showOnlySelectedRegion=true&layer=NobwRAlgJmBcYGMD2BbADgGwKYA8D6UWALgIYQZgA0YaJATiSgM5zjLrY4CSM8AjAAYATADY%2BAFjABfakyz0EACwAK9Ri1jhSAIzhh6RCAmxV9dQ8awAVBoSsBPNFg1gAgn2lSAukA",
    "body": "{\"size\":30,\"complexNumber\":\"102614\",\"tradeTypes\":[\"A1\"],\"pyeongTypes\":[],\"dongNumbers\":[],\"userChannelType\":\"PC\",\"articleSortType\":\"RANKING_DESC\",\"lastInfo\":[]}",
    "method": "POST",
    "mode": "cors",
    "credentials": "include"
    });

