cmake_minimum_required(VERSION 3.15)
project(BookEmbeddingsLocal)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Cartella di OGDF (sorgenti + build/). Ordine di ricerca:
#   1. -DOGDF_DIR=...  sulla riga di comando di cmake
#   2. variabile d'ambiente OGDF_DIR
#   3. ../../ogdf rispetto a questa cartella (clone di OGDF accanto al repository)
set(OGDF_DIR "" CACHE PATH "Cartella di OGDF (contiene include/ e build/)")
if(NOT OGDF_DIR AND DEFINED ENV{OGDF_DIR})
    set(OGDF_DIR "$ENV{OGDF_DIR}" CACHE PATH "Cartella di OGDF (contiene include/ e build/)" FORCE)
endif()
if(NOT OGDF_DIR)
    get_filename_component(_ogdf_default "${CMAKE_CURRENT_SOURCE_DIR}/../../ogdf" ABSOLUTE)
    set(OGDF_DIR "${_ogdf_default}" CACHE PATH "Cartella di OGDF (contiene include/ e build/)" FORCE)
endif()
if(NOT EXISTS "${OGDF_DIR}/include/ogdf")
    message(FATAL_ERROR "OGDF non trovato in '${OGDF_DIR}': passa -DOGDF_DIR=<percorso> o imposta la variabile d'ambiente OGDF_DIR")
endif()
set(OGDF_BUILD "${OGDF_DIR}/build")

add_executable(book_enum main_enum.cpp)
add_executable(book_webstyle main.cpp)

foreach(target book_enum book_webstyle)
    target_include_directories(${target} PRIVATE
        "${OGDF_DIR}/include"
        "${OGDF_BUILD}/include/ogdf-release"
    )

    target_link_directories(${target} PRIVATE
        "${OGDF_BUILD}"
    )

    target_link_libraries(${target} PRIVATE
        OGDF
        COIN
    )
endforeach()